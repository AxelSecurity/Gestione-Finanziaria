import fs from "fs/promises";
import path from "path";

export const RECEIPTS_DIR = process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "data", "receipts");
const MAX_BYTES = 8 * 1024 * 1024;

export async function saveReceipt(txId: string, file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/") || file.size > MAX_BYTES) throw new Error("Immagine scontrino non valida (max 8 MB)");
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
  const name = `${txId}.jpg`;
  await fs.writeFile(path.join(RECEIPTS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function readReceipt(name: string) {
  return fs.readFile(path.join(RECEIPTS_DIR, path.basename(name)));
}

export async function removeReceipt(name?: string | null) {
  if (name) await fs.rm(path.join(RECEIPTS_DIR, path.basename(name)), { force: true });
}
