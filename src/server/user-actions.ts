"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ensureUserDefaults } from "./defaults";
import { removeReceipt } from "./receipts";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

async function me() {
  const u = await currentUser();
  if (!u) throw new Error("Non autorizzato");
  return u;
}
async function admin() {
  const u = await me();
  if (!u.isAdmin) throw new Error("Riservato agli amministratori");
  return u;
}

// ---------- Profilo personale ----------
export async function updateProfile(_: FormState, f: FormData): Promise<FormState> {
  const u = await me();
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  if (!name) return { error: "Inserisci un nome" };
  if (!EMAIL.test(email)) return { error: "Email non valida" };
  if (email !== u.email) {
    if (!(await bcrypt.compare(String(f.get("currentPassword") ?? ""), u.password))) return { error: "Per cambiare email conferma la password attuale" };
    if (await db.user.findUnique({ where: { email } })) return { error: "Email già in uso" };
  }
  await db.user.update({ where: { id: u.id }, data: { name, email } });
  revalidatePath("/", "layout");
  return { ok: "Profilo aggiornato" };
}

export async function changePassword(_: FormState, f: FormData): Promise<FormState> {
  const u = await me();
  const next = String(f.get("newPassword") ?? "");
  if (!(await bcrypt.compare(String(f.get("currentPassword") ?? ""), u.password))) return { error: "Password attuale errata" };
  if (next.length < MIN_PASSWORD) return { error: `La nuova password deve avere almeno ${MIN_PASSWORD} caratteri` };
  if (next !== String(f.get("confirmPassword") ?? "")) return { error: "Le due password non coincidono" };
  await db.user.update({ where: { id: u.id }, data: { password: await bcrypt.hash(next, 10), sessionVersion: { increment: 1 } } });
  // invalida tutte le sessioni (anche altri dispositivi): serve un nuovo accesso
  await signOut({ redirectTo: "/login?changed=1" });
}

// ---------- Gestione utenti (solo admin) ----------
export async function createUser(_: FormState, f: FormData): Promise<FormState> {
  await admin();
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!name) return { error: "Inserisci un nome" };
  if (!EMAIL.test(email)) return { error: "Email non valida" };
  if (password.length < MIN_PASSWORD) return { error: `La password deve avere almeno ${MIN_PASSWORD} caratteri` };
  if (await db.user.findUnique({ where: { email } })) return { error: "Email già in uso" };
  const user = await db.user.create({ data: { name, email, password: await bcrypt.hash(password, 10), isAdmin: f.get("isAdmin") === "on" } });
  await ensureUserDefaults(user.id);
  revalidatePath("/users");
  return { ok: `Utente ${email} creato` };
}

export async function setUserActive(id: string, active: boolean) {
  const a = await admin();
  if (id === a.id) throw new Error("Non puoi disattivare te stesso");
  await db.user.update({ where: { id }, data: { active, ...(active ? {} : { sessionVersion: { increment: 1 } }) } });
  revalidatePath("/users");
}

export async function setUserAdmin(id: string, isAdmin: boolean) {
  const a = await admin();
  if (id === a.id) throw new Error("Non puoi cambiare il tuo ruolo");
  await db.user.update({ where: { id }, data: { isAdmin } });
  revalidatePath("/users");
}

export async function resetUserPassword(_: FormState, f: FormData): Promise<FormState> {
  await admin();
  const password = String(f.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `La password deve avere almeno ${MIN_PASSWORD} caratteri` };
  await db.user.update({ where: { id: str(f, "id") }, data: { password: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } } });
  return { ok: "Password reimpostata" };
}

/** Elimina l'utente e tutti i suoi dati (compresi gli scontrini archiviati). */
export async function deleteUser(id: string) {
  const a = await admin();
  if (id === a.id) throw new Error("Non puoi eliminare te stesso");
  const receipts = await db.transaction.findMany({ where: { userId: id, receiptFile: { not: null } }, select: { receiptFile: true } });
  const where = { userId: id };
  await db.$transaction([
    db.deadline.deleteMany({ where }), db.loan.deleteMany({ where }), db.transaction.deleteMany({ where }),
    db.recurringRule.deleteMany({ where }), db.budget.deleteMany({ where: { category: where } }),
    db.savingsGoal.deleteMany({ where }), db.holding.deleteMany({ where }), db.netWorthSnapshot.deleteMany({ where }),
    db.category.deleteMany({ where }), db.account.deleteMany({ where }), db.settings.deleteMany({ where }),
    db.user.delete({ where: { id } }),
  ]);
  for (const r of receipts) await removeReceipt(r.receiptFile);
  revalidatePath("/users");
}
