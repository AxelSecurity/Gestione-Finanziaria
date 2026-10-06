import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureUserDefaults } from "./defaults";

/** Idempotente. Crea l'admin iniziale, assegna i dati "orfani" (versioni precedenti, mono-utente) all'admin e prepara i default. */
export async function bootstrap() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      await db.user.create({ data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), isAdmin: true } });
    } else if (process.env.ADMIN_RESET_PASSWORD === "true") {
      // recupero password: imposta ADMIN_RESET_PASSWORD=true, riavvia, poi toglilo
      await db.user.update({ where: { email }, data: { password: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 }, active: true } });
    }
  }

  // migrazione da versione mono-utente: il primo utente diventa admin e possiede i dati esistenti
  if ((await db.user.count({ where: { isAdmin: true } })) === 0) {
    const first = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (first) await db.user.update({ where: { id: first.id }, data: { isAdmin: true } });
  }
  const owner = await db.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: "asc" } });
  if (owner) {
    const data = { userId: owner.id };
    const where = { userId: null };
    await Promise.all([
      db.account.updateMany({ where, data }), db.category.updateMany({ where, data }), db.transaction.updateMany({ where, data }),
      db.recurringRule.updateMany({ where, data }), db.savingsGoal.updateMany({ where, data }), db.deadline.updateMany({ where, data }),
      db.loan.updateMany({ where, data }), db.holding.updateMany({ where, data }), db.netWorthSnapshot.updateMany({ where, data }),
    ]);
    const legacy = await db.settings.findFirst({ where: { userId: null } });
    if (legacy && !(await db.settings.findUnique({ where: { userId: owner.id } }))) {
      await db.settings.update({ where: { id: legacy.id }, data: { userId: owner.id } });
    }
  }
  for (const u of await db.user.findMany({ select: { id: true } })) await ensureUserDefaults(u.id);
}
