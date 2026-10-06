const fmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });

export const formatEUR = (cents: number) => fmt.format(cents / 100);

/** Converte "12,50" / "12.50" in centesimi. */
export function parseEUR(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const n = Number(input.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Importo non valido");
  return Math.round(n * 100);
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

export const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function monthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { start, end };
}
