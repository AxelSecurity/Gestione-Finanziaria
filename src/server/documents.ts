import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const DOCS_DIR = process.env.DOCUMENTS_DIR ?? path.join(process.cwd(), "data", "documents");
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Estensioni ammesse → tipo MIME servito (non ci fidiamo di quello dichiarato dal client). `inline`: apribile nel browser. */
export const ALLOWED: Record<string, { mime: string; inline: boolean }> = {
  pdf: { mime: "application/pdf", inline: true },
  jpg: { mime: "image/jpeg", inline: true }, jpeg: { mime: "image/jpeg", inline: true },
  png: { mime: "image/png", inline: true }, webp: { mime: "image/webp", inline: true }, heic: { mime: "image/heic", inline: false },
  doc: { mime: "application/msword", inline: false },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  xls: { mime: "application/vnd.ms-excel", inline: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
  odt: { mime: "application/vnd.oasis.opendocument.text", inline: false },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", inline: false },
  txt: { mime: "text/plain; charset=utf-8", inline: false }, csv: { mime: "text/csv; charset=utf-8", inline: false },
};
export const ACCEPT = Object.keys(ALLOWED).map((e) => `.${e}`).join(",");

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const cleanName = (name: string) => name.replace(/[\u0000-\u001f/\\]/g, "").trim().slice(0, 120) || "documento";

/** Valida i file; ritorna un messaggio d'errore oppure null. */
export function validateFiles(files: File[]): string | null {
  for (const f of files) {
    if (!ALLOWED[extOf(f.name)]) return `Formato non ammesso: ${f.name}. Ammessi: PDF, immagini, Word, Excel, ODT/ODS, TXT, CSV.`;
    if (f.size > MAX_FILE_BYTES) return `${f.name} supera i ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

export async function saveDocuments(userId: string, deadlineId: string, files: File[]) {
  await fs.mkdir(DOCS_DIR, { recursive: true });
  for (const f of files) {
    const ext = extOf(f.name);
    const doc = await db.deadlineDocument.create({ data: { userId, deadlineId, name: cleanName(f.name), ext, size: f.size } });
    await fs.writeFile(path.join(DOCS_DIR, `${doc.id}.${ext}`), Buffer.from(await f.arrayBuffer()));
  }
}

export const docPath = (d: { id: string; ext: string }) => path.join(DOCS_DIR, `${d.id}.${d.ext}`);

export async function removeDocFiles(docs: { id: string; ext: string }[]) {
  for (const d of docs) await fs.rm(docPath(d), { force: true });
}

export const filesFrom = (f: FormData, key: string) => f.getAll(key).filter((v): v is File => v instanceof File && v.size > 0);
