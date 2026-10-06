import { db } from "@/lib/db";
import { nextOccurrence, addMonths, type Frequency } from "@/lib/recurrence";
import { amortization } from "@/lib/loans";
import { notify } from "./notifications";

/** Genera le transazioni delle regole ricorrenti scadute (di tutti gli utenti). */
export async function processRecurring(now = new Date()) {
  const rules = await db.recurringRule.findMany({ where: { active: true, nextDate: { lte: now } } });
  let created = 0;
  for (const rule of rules) {
    let next = rule.nextDate;
    const anchor = rule.nextDate.getDate();
    while (next <= now) {
      await db.transaction.create({
        data: {
          userId: rule.userId, date: next, amount: rule.amount, type: rule.type, note: rule.name,
          accountId: rule.accountId, categoryId: rule.categoryId, recurringId: rule.id,
        },
      });
      created++;
      next = nextOccurrence(next, rule.frequency as Frequency, anchor);
    }
    await db.recurringRule.update({ where: { id: rule.id }, data: { nextDate: next } });
  }
  return created;
}

/** Notifica le scadenze in arrivo: un messaggio al giorno per utente. Se `onlyUser` è impostato, tratta solo quell'utente (e ignora il "già notificato"). */
export async function notifyDeadlines(now = new Date(), onlyUser?: string) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today.getTime() + 60 * 86400000);
  const list = await db.deadline.findMany({ where: { paid: false, dueDate: { lte: horizon }, ...(onlyUser ? { userId: onlyUser } : {}) } });
  const daysTo = (d: Date) => Math.ceil((d.getTime() - today.getTime()) / 86400000);
  const due = list.filter((d) => daysTo(d.dueDate) <= d.remindDaysBefore && (onlyUser || !d.lastNotified || d.lastNotified < today));
  const byUser = new Map<string, typeof due>();
  for (const d of due) if (d.userId) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);
  for (const [userId, items] of byUser) {
    const lines = items.map((d) => {
      const days = daysTo(d.dueDate);
      const when = days < 0 ? `scaduta da ${-days} gg` : days === 0 ? "oggi" : `tra ${days} gg`;
      return `• ${d.title} — ${(d.amount / 100).toFixed(2)} € (${when})`;
    });
    await notify(userId, "Scadenze in arrivo", lines.join("\n"));
    await db.deadline.updateMany({ where: { id: { in: items.map((d) => d.id) } }, data: { lastNotified: now } });
  }
  return due.length;
}

export async function balances(userId: string) {
  const accounts = await db.account.findMany({ where: { userId, archived: false } });
  const out: Record<string, number> = {};
  for (const a of accounts) out[a.id] = a.initialBalance;
  const tx = await db.transaction.findMany({ where: { userId }, select: { type: true, amount: true, accountId: true, toAccountId: true } });
  for (const t of tx) {
    if (t.type === "INCOME" && t.accountId in out) out[t.accountId] += t.amount;
    else if (t.type === "EXPENSE" && t.accountId in out) out[t.accountId] -= t.amount;
    else if (t.type === "TRANSFER") {
      if (t.accountId in out) out[t.accountId] -= t.amount;
      if (t.toAccountId && t.toAccountId in out) out[t.toAccountId] += t.amount;
    }
  }
  return { accounts, byId: out, total: Object.values(out).reduce((a, b) => a + b, 0) };
}

/** Snapshot mensile del patrimonio netto per un utente. */
export async function takeSnapshot(userId: string, now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { total } = await balances(userId);
  const holdings = await db.holding.findMany({ where: { userId } });
  const investments = Math.round(holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0));
  const loans = await db.loan.findMany({ where: { userId }, include: { deadlines: { where: { paid: false } } } });
  const debt = loans.reduce((s, l) => s + residualDebt(l.deadlines.length, l.principal, l.annualRate, l.totalRates, l.installment), 0);
  await db.netWorthSnapshot.upsert({
    where: { userId_month: { userId, month } }, update: { cash: total, investments, debt },
    create: { userId, month, cash: total, investments, debt },
  });
}

export async function takeAllSnapshots(now = new Date()) {
  for (const u of await db.user.findMany({ where: { active: true }, select: { id: true } })) await takeSnapshot(u.id, now);
}

/** Debito residuo = saldo del piano di ammortamento dopo le rate già pagate. */
export function residualDebt(unpaid: number, principal: number, rate: number, total: number, installment: number) {
  const paid = total - unpaid;
  if (paid <= 0) return principal;
  if (unpaid <= 0) return 0;
  return amortization(principal, rate, total, installment)[paid - 1].balance;
}

export async function createLoanDeadlines(loanId: string) {
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  const rows = amortization(loan.principal, loan.annualRate, loan.totalRates, loan.installment);
  const anchor = loan.startDate.getDate();
  const cat = await db.category.findFirst({ where: { userId: loan.userId, name: "Rate e finanziamenti" } });
  await db.deadline.createMany({
    data: rows.map((r, i) => ({
      userId: loan.userId, title: `${loan.name} — rata ${r.n}/${loan.totalRates}`, kind: loan.kind, amount: r.payment,
      dueDate: addMonths(loan.startDate, i, anchor), loanId: loan.id, categoryId: cat?.id,
    })),
  });
}
