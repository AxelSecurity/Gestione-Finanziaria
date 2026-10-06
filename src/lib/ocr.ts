import type { Worker } from "tesseract.js";

let worker: Promise<Worker> | null = null;
let onProgress: ((p: number) => void) | null = null;

/** Worker Tesseract condiviso; modello e core serviti da /tesseract (nessuna chiamata a servizi esterni). */
function getWorker() {
  worker ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("ita", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract",
      langPath: "/tesseract",
      logger: (m) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
    }),
  );
  return worker;
}

export async function recognize(canvas: HTMLCanvasElement, progress?: (p: number) => void): Promise<string> {
  onProgress = progress ?? null;
  try {
    const w = await getWorker();
    const { data } = await w.recognize(canvas);
    return data.text;
  } catch (e) {
    worker = null;
    throw e;
  } finally {
    onProgress = null;
  }
}
