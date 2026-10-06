export type Frequency = "WEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "YEARLY";

const MONTHS: Record<Exclude<Frequency, "WEEKLY">, number> = {
  MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, YEARLY: 12,
};

/** Aggiunge `n` mesi mantenendo il giorno (clamp a fine mese: 31 gen + 1 mese = 28/29 feb). */
export function addMonths(d: Date, n: number, anchorDay = d.getDate()): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(anchorDay, last));
}

export function nextOccurrence(d: Date, freq: Frequency, anchorDay = d.getDate()): Date {
  if (freq === "WEEKLY") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  return addMonths(d, MONTHS[freq], anchorDay);
}
