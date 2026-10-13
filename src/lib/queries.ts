import { db } from "@/lib/db";
import type { Bucket } from "@/lib/rule503020";

/** Entrate e spese per bucket nel periodo [start, end) dell'utente. Un trasferimento verso un conto risparmio/investimento conta come risparmio. */
export async function monthSummary(userId: string, start: Date, end: Date) {
  const tx = await db.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: { category: true, account: true, toAccount: true },
  });
  let income = 0, expense = 0;
  const spent: Record<Bucket, number> = { NEEDS: 0, WANTS: 0, SAVINGS: 0 };
  const byCategory = new Map<string, number>();
  let uncategorized = 0, savingsTransfers = 0;
  const isSaving = (k?: string) => k === "SAVINGS" || k === "INVESTMENT";
  for (const t of tx) {
    if (t.type === "TRANSFER") {
      if (isSaving(t.toAccount?.kind) && !isSaving(t.account.kind)) { spent.SAVINGS += t.amount; savingsTransfers += t.amount; }
      continue;
    }
    if (t.type === "INCOME") { income += t.amount; continue; }
    expense += t.amount;
    const b = t.category?.bucket as Bucket | undefined;
    if (b && b in spent) spent[b] += t.amount;
    else { spent.WANTS += t.amount; uncategorized += t.amount; } // non categorizzato: conta come desiderio
    if (t.categoryId) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  return { income, expense, spent, byCategory, uncategorized, savingsTransfers };
}

/** Base di calcolo del 50/30/20: stipendio di riferimento se impostato, altrimenti le entrate registrate nel mese. */
export const incomeBase = (fixed: number, income: number) => (fixed > 0 ? fixed : income);
