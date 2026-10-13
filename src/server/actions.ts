"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { parseEUR } from "@/lib/money";
import { addMonths } from "@/lib/recurrence";
import { monthlyPayment } from "@/lib/loans";
import { createLoanDeadlines, notifyDeadlines, processRecurring, takeSnapshot } from "./services";
import { notify } from "./notifications";
import { removeReceipt, saveReceipt } from "./receipts";

/** Utente autenticato e attivo, altrimenti errore. Tutte le query sono filtrate per questo id. */
async function uid() {
  const u = await currentUser();
  if (!u) throw new Error("Non autorizzato");
  return u.id;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optId = (f: FormData, k: string) => str(f, k) || null;
const done = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

async function checkAccount(userId: string, id: string | null) {
  if (id && !(await db.account.findFirst({ where: { id, userId }, select: { id: true } }))) throw new Error("Conto non valido");
  return id;
}
async function checkCategory(userId: string, id: string | null) {
  if (id && !(await db.category.findFirst({ where: { id, userId }, select: { id: true } }))) throw new Error("Categoria non valida");
  return id;
}

// ---------- Auth ----------
export type LoginState = { error?: string; email?: string } | undefined;
export async function loginAction(_: LoginState, f: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", { email: str(f, "email"), password: str(f, "password"), redirectTo: "/" });
  } catch (e) {
    if ((e as Error).message?.includes("NEXT_REDIRECT") || (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: "Credenziali non valide o account bloccato temporaneamente", email: str(f, "email") };
  }
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------- Transazioni ----------
const txSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.string().min(1),
  amount: z.string().min(1),
  accountId: z.string().min(1),
});

export async function saveTransaction(f: FormData) {
  const userId = await uid();
  const p = txSchema.parse(Object.fromEntries([...f].filter(([, v]) => typeof v === "string")));
  const amount = parseEUR(p.amount);
  if (amount <= 0) throw new Error("L'importo deve essere positivo");
  const transfer = p.type === "TRANSFER";
  const data = {
    type: p.type, date: new Date(p.date), amount, accountId: (await checkAccount(userId, p.accountId))!,
    toAccountId: transfer ? await checkAccount(userId, optId(f, "toAccountId")) : null,
    categoryId: transfer ? null : await checkCategory(userId, optId(f, "categoryId")),
    note: str(f, "note"),
  };
  const id = str(f, "id");
  if (id && !(await db.transaction.findFirst({ where: { id, userId }, select: { id: true } }))) throw new Error("Movimento non trovato");
  const receipt = f.get("receipt");
  const hasNewReceipt = receipt instanceof File && receipt.size > 0;
  // in modifica: "Rimuovi scontrino" elimina il file e svuota il riferimento (se non ne arriva uno nuovo)
  const dropReceipt = !!id && f.get("dropReceipt") === "1" && !hasNewReceipt;
  if (dropReceipt) {
    const old = await db.transaction.findFirst({ where: { id, userId }, select: { receiptFile: true } });
    await removeReceipt(old?.receiptFile);
  }
  const saved = id
    ? await db.transaction.update({ where: { id }, data: dropReceipt ? { ...data, receiptFile: null } : data })
    : await db.transaction.create({ data: { ...data, userId } });
  if (hasNewReceipt) {
    const name = await saveReceipt(saved.id, receipt);
    if (name) await db.transaction.update({ where: { id: saved.id }, data: { receiptFile: name } });
  }
  done("/", "/transactions", "/budget", "/reports");
}
export async function deleteTransaction(id: string) {
  const userId = await uid();
  const tx = await db.transaction.findFirst({ where: { id, userId }, select: { receiptFile: true } });
  if (!tx) return;
  await db.transaction.delete({ where: { id } });
  await removeReceipt(tx.receiptFile);
  done("/", "/transactions", "/budget", "/reports", "/deadlines");
}

// ---------- Ricorrenti ----------
export async function saveRecurring(f: FormData) {
  const userId = await uid();
  await db.recurringRule.create({
    data: {
      userId, name: str(f, "name"), type: str(f, "type") === "INCOME" ? "INCOME" : "EXPENSE",
      amount: parseEUR(str(f, "amount")), frequency: str(f, "frequency") || "MONTHLY",
      nextDate: new Date(str(f, "nextDate")), accountId: (await checkAccount(userId, str(f, "accountId")))!,
      categoryId: await checkCategory(userId, optId(f, "categoryId")),
    },
  });
  await processRecurring();
  done("/transactions", "/");
}
export async function toggleRecurring(id: string, active: boolean) {
  const userId = await uid();
  await db.recurringRule.updateMany({ where: { id, userId }, data: { active } });
  done("/transactions");
}
export async function deleteRecurring(id: string) {
  const userId = await uid();
  await db.recurringRule.deleteMany({ where: { id, userId } });
  done("/transactions");
}

// ---------- Conti e categorie ----------
export async function saveAccount(f: FormData) {
  const userId = await uid();
  await db.account.create({
    data: { userId, name: str(f, "name"), kind: str(f, "kind") || "CHECKING", initialBalance: parseEUR(str(f, "initialBalance") || "0") },
  });
  done("/settings", "/", "/transactions");
}
export async function archiveAccount(id: string) {
  const userId = await uid();
  await db.account.updateMany({ where: { id, userId }, data: { archived: true } });
  done("/settings", "/", "/transactions");
}
export async function saveCategory(f: FormData) {
  const userId = await uid();
  const bucket = ["NEEDS", "WANTS", "SAVINGS", "INCOME"].includes(str(f, "bucket")) ? str(f, "bucket") : "WANTS";
  await db.category.create({ data: { userId, name: str(f, "name"), bucket, color: str(f, "color") || "#64748b" } });
  done("/settings", "/budget", "/transactions");
}
export async function deleteCategory(id: string) {
  const userId = await uid();
  if (!(await db.category.findFirst({ where: { id, userId } }))) return;
  const used = await db.transaction.count({ where: { categoryId: id } });
  if (used) throw new Error("Categoria in uso da transazioni");
  await db.category.delete({ where: { id } });
  done("/settings", "/budget", "/transactions");
}
export async function saveTargets(f: FormData) {
  const userId = await uid();
  const [n, w, s] = ["needsPct", "wantsPct", "savingsPct"].map((k) => Number(f.get(k)));
  if (![n, w, s].every((x) => Number.isInteger(x) && x >= 0 && x <= 100) || n + w + s !== 100) return; // il form client mostra già l'errore
  await db.settings.update({ where: { userId }, data: { needsPct: n, wantsPct: w, savingsPct: s } });
  done("/", "/budget");
}
export async function saveNotifyPrefs(f: FormData) {
  const userId = await uid();
  await db.settings.update({
    where: { userId },
    data: {
      notifyTelegram: f.get("notifyTelegram") === "on", notifyEmail: f.get("notifyEmail") === "on",
      telegramChatId: str(f, "telegramChatId"), notifyEmailTo: str(f, "notifyEmailTo"),
    },
  });
  done("/settings", "/profile");
}
export async function sendTestNotification() {
  return notify(await uid(), "Test notifica", "Le notifiche di Gestione Finanziaria funzionano.");
}
export async function runNotifyNow() {
  return notifyDeadlines(new Date(), await uid());
}

// ---------- Budget e obiettivi ----------
export async function saveBudget(f: FormData) {
  const userId = await uid();
  const categoryId = (await checkCategory(userId, str(f, "categoryId")))!;
  const monthly = parseEUR(str(f, "monthly") || "0");
  if (monthly <= 0) await db.budget.deleteMany({ where: { categoryId } });
  else await db.budget.upsert({ where: { categoryId }, update: { monthly }, create: { categoryId, monthly } });
  done("/budget", "/");
}
export async function saveGoal(f: FormData) {
  const userId = await uid();
  await db.savingsGoal.create({
    data: { userId, name: str(f, "name"), target: parseEUR(str(f, "target")), dueDate: str(f, "dueDate") ? new Date(str(f, "dueDate")) : null },
  });
  done("/budget");
}
export async function contributeGoal(f: FormData) {
  const userId = await uid();
  await db.savingsGoal.updateMany({ where: { id: str(f, "id"), userId }, data: { saved: { increment: parseEUR(str(f, "amount")) } } });
  done("/budget");
}
export async function deleteGoal(id: string) {
  const userId = await uid();
  await db.savingsGoal.deleteMany({ where: { id, userId } });
  done("/budget");
}

// ---------- Scadenzario ----------
export async function saveDeadline(f: FormData) {
  const userId = await uid();
  await db.deadline.create({
    data: {
      userId, title: str(f, "title"), kind: str(f, "kind") || "BOLLETTA", amount: parseEUR(str(f, "amount") || "0"),
      dueDate: new Date(str(f, "dueDate")), recurrence: str(f, "recurrence") || "NONE",
      remindDaysBefore: Number(f.get("remindDaysBefore") ?? 3), categoryId: await checkCategory(userId, optId(f, "categoryId")),
    },
  });
  done("/deadlines", "/");
}

const REC_MONTHS: Record<string, number> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, YEARLY: 12 };

/** Segna pagata: crea la transazione di spesa e, se ricorrente, genera la prossima scadenza. */
export async function payDeadline(f: FormData) {
  const userId = await uid();
  const d = await db.deadline.findFirst({ where: { id: str(f, "id"), userId } });
  if (!d || d.paid) return;
  const accountId = (await checkAccount(userId, str(f, "accountId")))!;
  const paidAt = str(f, "paidAt") ? new Date(str(f, "paidAt")) : new Date();
  const tx = await db.transaction.create({
    data: { userId, type: "EXPENSE", date: paidAt, amount: d.amount, accountId, categoryId: d.categoryId, note: d.title },
  });
  await db.deadline.update({ where: { id: d.id }, data: { paid: true, paidAt, transactionId: tx.id } });
  const months = REC_MONTHS[d.recurrence];
  if (months && !d.loanId) {
    await db.deadline.create({
      data: {
        userId, title: d.title, kind: d.kind, amount: d.amount, recurrence: d.recurrence,
        remindDaysBefore: d.remindDaysBefore, categoryId: d.categoryId, dueDate: addMonths(d.dueDate, months),
      },
    });
  }
  done("/deadlines", "/", "/transactions", "/budget");
}
export async function unpayDeadline(id: string) {
  const userId = await uid();
  const d = await db.deadline.findFirst({ where: { id, userId } });
  if (!d) return;
  if (d.transactionId) await db.transaction.deleteMany({ where: { id: d.transactionId, userId } });
  await db.deadline.update({ where: { id }, data: { paid: false, paidAt: null, transactionId: null } });
  done("/deadlines", "/", "/transactions");
}
export async function deleteDeadline(id: string) {
  const userId = await uid();
  await db.deadline.deleteMany({ where: { id, userId } });
  done("/deadlines", "/");
}
export async function saveLoan(f: FormData) {
  const userId = await uid();
  const principal = parseEUR(str(f, "principal"));
  const annualRate = Number(str(f, "annualRate").replace(",", ".") || 0);
  const totalRates = Number(f.get("totalRates"));
  const installment = str(f, "installment") ? parseEUR(str(f, "installment")) : monthlyPayment(principal, annualRate, totalRates);
  const loan = await db.loan.create({
    data: { userId, name: str(f, "name"), kind: str(f, "kind") || "MUTUO", principal, annualRate, totalRates, installment, startDate: new Date(str(f, "startDate")) },
  });
  await createLoanDeadlines(loan.id);
  done("/deadlines", "/investments");
}
export async function deleteLoan(id: string) {
  const userId = await uid();
  await db.loan.deleteMany({ where: { id, userId } });
  done("/deadlines", "/investments");
}

// ---------- Investimenti ----------
export async function saveHolding(f: FormData) {
  const userId = await uid();
  const id = str(f, "id");
  const data = {
    name: str(f, "name"), symbol: str(f, "symbol"), kind: str(f, "kind") || "ETF",
    quantity: Number(str(f, "quantity").replace(",", ".")), avgPrice: parseEUR(str(f, "avgPrice")),
    currentPrice: parseEUR(str(f, "currentPrice") || str(f, "avgPrice")),
  };
  if (id) await db.holding.updateMany({ where: { id, userId }, data });
  else await db.holding.create({ data: { ...data, userId } });
  await takeSnapshot(userId);
  done("/investments", "/");
}
export async function updateHoldingPrice(f: FormData) {
  const userId = await uid();
  await db.holding.updateMany({ where: { id: str(f, "id"), userId }, data: { currentPrice: parseEUR(str(f, "currentPrice")) } });
  await takeSnapshot(userId);
  done("/investments", "/");
}
export async function deleteHolding(id: string) {
  const userId = await uid();
  await db.holding.deleteMany({ where: { id, userId } });
  await takeSnapshot(userId);
  done("/investments", "/");
}
export async function snapshotNow() {
  await takeSnapshot(await uid());
  done("/investments");
}
