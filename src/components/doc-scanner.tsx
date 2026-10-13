"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ImageIcon, Loader2, Plus, RotateCw, ScanLine, Trash2, X } from "lucide-react";
import { buildPdf, canvasToJpeg, defaultCorners, detectCorners, enhance, rotate90, toCanvas, warpPerspective, type Filter, type Pt } from "@/lib/doc-scan";

type Step = "closed" | "pick" | "crop" | "review";
type Page = { id: number; canvas: HTMLCanvasElement };
const FILTERS: { v: Filter; l: string }[] = [{ v: "color", l: "Colore" }, { v: "gray", l: "Grigi" }, { v: "bw", l: "Bianco e nero" }];
const MAX_PAGES = 20;

/**
 * Scanner di documenti cartacei: foto → ritaglio bordi (automatico + regolabile) → effetto scanner → PDF.
 * Il PDF viene aggiunto al campo file `documents` del form che contiene il componente.
 */
export function DocScanner({ autoSubmit = false }: { autoSubmit?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("closed");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const source = useRef<HTMLCanvasElement | null>(null);
  const [corners, setCorners] = useState<Pt[]>(defaultCorners());
  const [cropUrl, setCropUrl] = useState("");

  const [pages, setPages] = useState<Page[]>([]);
  const [filter, setFilter] = useState<Filter>("color");
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const seq = useRef(0);
  const [name, setName] = useState("");

  const reset = () => { setStep("closed"); setPages([]); setThumbs({}); cache.current.clear(); source.current = null; setError(""); setBusy(null); };

  const enhanced = (p: Page, f: Filter) => {
    const k = `${p.id}-${f}-${p.canvas.width}x${p.canvas.height}`;
    let c = cache.current.get(k);
    if (!c) { c = enhance(p.canvas, f); cache.current.set(k, c); }
    return c;
  };

  // miniature dei risultati (si ricalcolano al cambio di filtro/pagine)
  useEffect(() => {
    if (step !== "review") return;
    let cancelled = false;
    setBusy("Elaboro…");
    const t = setTimeout(() => {
      const next: Record<number, string> = {};
      for (const p of pages) next[p.id] = toCanvas(enhanced(p, filter), 900).toDataURL("image/jpeg", 0.7);
      if (!cancelled) { setThumbs(next); setBusy(null); }
    }, 30);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pages, filter]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setError(""); setBusy("Cerco i bordi del foglio…");
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      const src = toCanvas(bmp, 3000); bmp.close?.();
      source.current = src;
      setCropUrl(toCanvas(src, 1200).toDataURL("image/jpeg", 0.85));
      await new Promise((r) => setTimeout(r, 20));
      setCorners(detectCorners(src));
      setStep("crop");
    } catch {
      setError("Non riesco a leggere questa immagine.");
    } finally { setBusy(null); }
  }

  async function confirmCrop() {
    if (!source.current) return;
    setBusy("Raddrizzo il documento…");
    await new Promise((r) => setTimeout(r, 30));
    const s = source.current;
    const px = corners.map((c) => ({ x: c.x * s.width, y: c.y * s.height }));
    const canvas = warpPerspective(s, px, 2000);
    setPages((p) => [...p, { id: ++seq.current, canvas }]);
    setBusy(null); setStep("review");
  }

  async function finish() {
    try {
      setBusy("Creo il PDF…");
      const out: { jpeg: Uint8Array; w: number; h: number }[] = [];
      for (const p of pages) { const c = enhanced(p, filter); out.push({ jpeg: await canvasToJpeg(c, 0.82), w: c.width, h: c.height }); }
      const pdf = buildPdf(out);
      const fileName = `${(name.trim() || `Scansione ${new Date().toISOString().slice(0, 10)}`).replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
      const file = new File([pdf.buffer as ArrayBuffer], fileName, { type: "application/pdf" });
      const form = root.current?.closest("form");
      const input = form?.querySelector<HTMLInputElement>("input[name=documents]");
      if (!form || !input) throw new Error("campo documenti non trovato");
      const dt = new DataTransfer();
      for (const f of Array.from(input.files ?? [])) dt.items.add(f);
      dt.items.add(file);
      input.files = dt.files;
      setDone(`${fileName} (${pages.length} pag.) pronto da caricare`);
      reset();
      if (autoSubmit) form.requestSubmit();
    } catch (e) {
      setError("Impossibile creare il PDF: " + (e as Error).message); setBusy(null);
    }
  }

  const mutate = (id: number, fn: (c: HTMLCanvasElement) => HTMLCanvasElement) =>
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, canvas: fn(p.canvas) } : p)));

  return (
    <span ref={root} className="inline-flex flex-col gap-1">
      <button type="button" className="btn-outline gap-2" onClick={() => { setDone(""); setStep("pick"); }}><ScanLine size={18} /> Scansiona documento</button>
      {done && <span className="text-xs font-medium text-emerald-700">✓ {done}</span>}

      {step !== "closed" && createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <header className="flex items-center justify-between px-4 py-3">
            <div className="font-semibold">{step === "pick" ? "Scansiona documento" : step === "crop" ? "Regola i bordi" : `Risultato · ${pages.length} pagin${pages.length === 1 ? "a" : "e"}`}</div>
            <button type="button" onClick={reset} className="rounded-lg p-2 hover:bg-white/10" aria-label="Chiudi"><X size={20} /></button>
          </header>

          <div className="relative flex-1 overflow-y-auto px-4 pb-4">
            {error && <p className="mb-3 rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{error}</p>}

            {step === "pick" && (
              <div className="mx-auto flex max-w-sm flex-col gap-3 pt-6 text-center">
                <p className="text-sm text-white/70">Fotografa il foglio su un piano scuro e ben illuminato. Ritaglio, prospettiva e contrasto si sistemano da soli.</p>
                <button type="button" className="btn gap-2 py-3" onClick={() => camera.current?.click()}><Camera size={18} /> Scatta foto</button>
                <button type="button" className="btn-outline gap-2 !border-white/20 !bg-white/10 !text-white" onClick={() => gallery.current?.click()}><ImageIcon size={18} /> Scegli dalla galleria</button>
              </div>
            )}

            {step === "crop" && <CropEditor url={cropUrl} corners={corners} onChange={setCorners} />}

            {step === "review" && (
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <button type="button" key={f.v} onClick={() => setFilter(f.v)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === f.v ? "bg-emerald-500 text-white" : "bg-white/10 text-white/80"}`}>{f.l}</button>
                  ))}
                </div>
                <div className="space-y-4">
                  {pages.map((p, i) => (
                    <div key={p.id} className="rounded-xl bg-white/5 p-2">
                      <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                        <span>Pagina {i + 1}</span>
                        <span className="flex gap-1">
                          <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Ruota" onClick={() => mutate(p.id, rotate90)}><RotateCw size={16} /></button>
                          <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Elimina pagina" onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))}><Trash2 size={16} /></button>
                        </span>
                      </div>
                      {thumbs[p.id] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumbs[p.id]} alt={`Pagina ${i + 1}`} className="mx-auto max-h-[60vh] w-auto rounded-lg bg-white" /> : <div className="flex h-40 items-center justify-center text-white/40"><Loader2 className="animate-spin" /></div>}
                    </div>
                  ))}
                </div>
                {pages.length < MAX_PAGES && <button type="button" className="btn-outline w-full gap-2 !border-white/20 !bg-white/10 !text-white" onClick={() => setStep("pick")}><Plus size={18} /> Aggiungi pagina</button>}
                <div><label className="label !text-white/50">Nome del documento</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. F24 TARI 2026" className="input !border-white/20 !bg-white/10 !text-white placeholder:text-white/40" /></div>
              </div>
            )}

            {busy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60"><div className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm"><Loader2 className="animate-spin" size={18} />{busy}</div></div>}
          </div>

          {step === "crop" && (
            <footer className="flex gap-2 border-t border-white/10 px-4 py-3">
              <button type="button" className="btn-outline flex-1 !border-white/20 !bg-white/10 !text-white" onClick={() => { if (source.current) setCorners(detectCorners(source.current)); }}>Rileva bordi</button>
              <button type="button" className="btn-outline flex-1 !border-white/20 !bg-white/10 !text-white" onClick={() => setCorners([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])}>Intera foto</button>
              <button type="button" className="btn flex-1 gap-1" disabled={!!busy} onClick={confirmCrop}><Check size={18} /> Conferma</button>
            </footer>
          )}
          {step === "review" && (
            <footer className="flex gap-2 border-t border-white/10 px-4 py-3">
              <button type="button" className="btn-outline !border-white/20 !bg-white/10 !text-white" onClick={reset}>Annulla</button>
              <button type="button" className="btn flex-1 gap-1" disabled={!!busy || pages.length === 0} onClick={finish}><Check size={18} /> Usa {pages.length} pagin{pages.length === 1 ? "a" : "e"}</button>
            </footer>
          )}
        </div>,
        document.body,
      )}

      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={onFile} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" tabIndex={-1} onChange={onFile} />
    </span>
  );
}

/** Foto con 4 maniglie trascinabili (mouse o tocco) per regolare il ritaglio. */
function CropEditor({ url, corners, onChange }: { url: string; corners: Pt[]; onChange: (c: Pt[]) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (drag.current === null || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onChange(corners.map((c, i) => (i === drag.current ? { x, y } : c)));
  };
  return (
    <div className="mx-auto max-w-xl">
      <div ref={box} className="relative select-none" style={{ touchAction: "none" }} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Foto del documento" className="block w-full rounded-lg" draggable={false} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={corners.map((c) => `${c.x * 100},${c.y * 100}`).join(" ")} fill="rgba(16,185,129,0.18)" stroke="#10b981" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
        {corners.map((c, i) => (
          <div key={i} data-handle={i} onPointerDown={(e) => { drag.current = i; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, touchAction: "none" }}>
            <span className="h-5 w-5 rounded-full border-2 border-white bg-emerald-500 shadow-lg" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-white/60">Trascina i quattro punti sugli angoli del foglio.</p>
    </div>
  );
}
