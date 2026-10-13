/** Scanner di documenti nel browser: rilevamento bordi, correzione prospettica, miglioramento "da scanner" e PDF multipagina. */
export type Pt = { x: number; y: number };
export type Filter = "color" | "gray" | "bw";

const clamp = (v: number, a = 0, b = 255) => (v < a ? a : v > b ? b : v);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Disegna l'immagine in un canvas con il lato lungo ≤ maxSide. */
export function toCanvas(src: CanvasImageSource & { width: number; height: number }, maxSide: number) {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = makeCanvas(src.width * k, src.height * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Margine di sicurezza: se il rilevamento fallisce si parte da un rettangolo quasi pieno. */
export const defaultCorners = (): Pt[] => [{ x: 0.05, y: 0.05 }, { x: 0.95, y: 0.05 }, { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }];

/** Trova gli angoli (TL, TR, BR, BL) normalizzati 0..1 della pagina chiara più grande nella foto. */
export function detectCorners(src: HTMLCanvasElement): Pt[] {
  const small = toCanvas(src, 320);
  const w = small.width, h = small.height;
  const d = small.getContext("2d")!.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;

  // sfocatura 3x3 e soglia di Otsu
  const blur = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += gray[yy * w + xx]; n++; }
    }
    blur[y * w + x] = s / n;
  }
  const hist = new Array(256).fill(0);
  for (const v of blur) hist[v]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = w * h - wB; if (!wF) break;
    sB += t * hist[t];
    const between = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
    if (between > best) { best = between; thr = t; }
  }

  // componente connessa chiara più grande
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestLabel = 0, bestSize = 0, cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (blur[i] <= thr || label[i]) continue;
    cur++;
    let sp = 0, size = 0;
    stack[sp++] = i; label[i] = cur;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && blur[p - 1] > thr && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && blur[p + 1] > thr && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
      if (y > 0 && blur[p - w] > thr && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
      if (y < h - 1 && blur[p + w] > thr && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; bestLabel = cur; }
  }
  if (!bestLabel || bestSize < w * h * 0.12) return defaultCorners();

  // estremi diagonali della regione = angoli del foglio
  let tl = Infinity, br = -Infinity, tr = -Infinity, bl = Infinity;
  const c: Pt[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== bestLabel) continue;
    const x = i % w, y = (i / w) | 0, s = x + y, df = x - y;
    if (s < tl) { tl = s; c[0] = { x, y }; }
    if (df > tr) { tr = df; c[1] = { x, y }; }
    if (s > br) { br = s; c[2] = { x, y }; }
    if (df < bl) { bl = df; c[3] = { x, y }; }
  }
  const area = Math.abs(c[0].x * c[1].y - c[1].x * c[0].y + c[1].x * c[2].y - c[2].x * c[1].y + c[2].x * c[3].y - c[3].x * c[2].y + c[3].x * c[0].y - c[0].x * c[3].y) / 2;
  if (area < w * h * 0.12) return defaultCorners();
  // piccolo margine verso l'interno per non includere il bordo del tavolo
  const m = { x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4, y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4 };
  return c.map((p) => ({ x: (p.x + (m.x - p.x) * 0.01 + 0.5) / w, y: (p.y + (m.y - p.y) * 0.01 + 0.5) / h }));
}

/** Risolve il sistema 8x8 dell'omografia che porta il rettangolo destinazione sul quadrilatero sorgente. */
function homography(dst: Pt[], src: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i], { x, y } = src[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let k = col; k < 9; k++) A[r][k] -= f * A[col][k];
    }
  }
  return A.map((row, i) => row[8] / row[i]);
}

/** Raddrizza il quadrilatero (angoli in pixel della sorgente) in un rettangolo. */
export function warpPerspective(src: HTMLCanvasElement, corners: Pt[], maxSide = 2000): HTMLCanvasElement {
  const [tl, tr, br, bl] = corners;
  let W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br));
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));
  const out = makeCanvas(W, H);
  const sw = src.width, sh = src.height;
  const sd = src.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const hm = homography([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], corners);
  const od = out.getContext("2d")!.createImageData(W, H);
  const o = od.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const den = hm[6] * x + hm[7] * y + 1;
    const sx = (hm[0] * x + hm[1] * y + hm[2]) / den, sy = (hm[3] * x + hm[4] * y + hm[5]) / den;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const i = (y * W + x) * 4;
    if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { o[i] = o[i + 1] = o[i + 2] = 255; o[i + 3] = 255; continue; }
    const p00 = (y0 * sw + x0) * 4, p10 = p00 + 4, p01 = p00 + sw * 4, p11 = p01 + 4;
    for (let c = 0; c < 3; c++) o[i + c] = sd[p00 + c] * (1 - fx) * (1 - fy) + sd[p10 + c] * fx * (1 - fy) + sd[p01 + c] * (1 - fx) * fy + sd[p11 + c] * fx * fy;
    o[i + 3] = 255;
  }
  out.getContext("2d")!.putImageData(od, 0, 0);
  return out;
}

export function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.height, src.width);
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(src, 0, 0);
  return out;
}

/** Effetto scanner: toglie ombre e illuminazione non uniforme (normalizza sullo sfondo carta), schiarisce la carta e scurisce il testo. */
export function enhance(src: HTMLCanvasElement, mode: Filter): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const img = src.getContext("2d")!.getImageData(0, 0, w, h);
  const d = img.data;
  const lum = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;

  // stima dello sfondo carta: per ogni blocco, media del 35% dei pixel più chiari
  const B = Math.max(12, Math.round(Math.max(w, h) / 70));
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  let grid = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
    hist.fill(0);
    let n = 0;
    for (let y = by * B; y < Math.min(h, (by + 1) * B); y += 2) for (let x = bx * B; x < Math.min(w, (bx + 1) * B); x += 2) { hist[lum[y * w + x]]++; n++; }
    let need = Math.max(1, Math.round(n * 0.35)), sum = 0, cnt = 0;
    for (let v = 255; v >= 0 && need > 0; v--) { const t = Math.min(hist[v], need); sum += t * v; cnt += t; need -= t; }
    grid[by * gw + bx] = cnt ? sum / cnt : 255;
  }
  // levigatura della griglia (3x3)
  const sm = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) { s += grid[yy * gw + xx]; n++; } }
    sm[y * gw + x] = s / n;
  }
  grid = sm;

  const out = makeCanvas(w, h);
  const od = out.getContext("2d")!.createImageData(w, h);
  const o = od.data;
  const levels = (v: number) => clamp(((v - 25) / (238 - 25)) * 255);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.max(0, y / B - 0.5)), y0 = Math.floor(gy), y1 = Math.min(gh - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.max(0, x / B - 0.5)), x0 = Math.floor(gx), x1 = Math.min(gw - 1, x0 + 1), fx = gx - x0;
      const bg = grid[y0 * gw + x0] * (1 - fx) * (1 - fy) + grid[y0 * gw + x1] * fx * (1 - fy) + grid[y1 * gw + x0] * (1 - fx) * fy + grid[y1 * gw + x1] * fx * fy;
      const gain = 255 / Math.max(bg, 70);
      const i = (y * w + x) * 4;
      if (mode === "color") {
        o[i] = levels(d[i] * gain); o[i + 1] = levels(d[i + 1] * gain); o[i + 2] = levels(d[i + 2] * gain);
      } else {
        let l = levels(lum[y * w + x] * gain);
        if (mode === "bw") { const t = clamp((l - 105) / (175 - 105), 0, 1); l = t * t * (3 - 2 * t) * 255; }
        o[i] = o[i + 1] = o[i + 2] = l;
      }
      o[i + 3] = 255;
    }
  }
  out.getContext("2d")!.putImageData(od, 0, 0);
  return out;
}

export const canvasToJpeg = (c: HTMLCanvasElement, q = 0.8) =>
  new Promise<Uint8Array>((res, rej) => c.toBlob(async (b) => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("JPEG non valido"))), "image/jpeg", q));

/** PDF minimale: una pagina per immagine JPEG (formato A4, orientamento e proporzioni dell'immagine). */
export function buildPdf(pages: { jpeg: Uint8Array; w: number; h: number }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; chunks.push(u); pos += u.length; };
  const obj = (n: number, body: string | (() => void)) => { offsets[n] = pos; push(`${n} 0 obj\n`); typeof body === "string" ? push(body) : body(); push("\nendobj\n"); };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
  pages.forEach((p, i) => {
    const landscape = p.w > p.h;
    const [boxW, boxH] = landscape ? [842, 595] : [595, 842];
    const k = Math.min(boxW / p.w, boxH / p.h);
    const W = +(p.w * k).toFixed(2), H = +(p.h * k).toFixed(2);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    const pn = 3 + i * 3;
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>`);
    obj(pn + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(pn + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg); push("\nendstream");
    });
  });
  const total = 3 + pages.length * 3;
  const xref = pos;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos);
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
