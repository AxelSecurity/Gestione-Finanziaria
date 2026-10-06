// Copia worker/core di tesseract.js in public/ e scarica il modello italiano (OCR eseguito nel browser, nulla esce dal tuo server).
import fs from "fs";
import path from "path";
import zlib from "zlib";

const out = path.resolve("public/tesseract");
fs.mkdirSync(out, { recursive: true });
const copy = (from, to = path.basename(from)) => fs.copyFileSync(from, path.join(out, to));

copy("node_modules/tesseract.js/dist/worker.min.js");
for (const f of ["tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js"]) copy(path.join("node_modules/tesseract.js-core", f));

const lang = path.join(out, "ita.traineddata.gz");
if (!fs.existsSync(lang)) {
  const url = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/ita.traineddata";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download modello OCR fallito: ${res.status}`);
  fs.writeFileSync(lang, zlib.gzipSync(Buffer.from(await res.arrayBuffer())));
}
console.log("OCR assets pronti in", out);
