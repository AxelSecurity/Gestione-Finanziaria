import { db } from "@/lib/db";

const DEFAULT_CATEGORIES: [string, string, string][] = [
  ["Stipendio", "INCOME", "#10b981"], ["Altre entrate", "INCOME", "#34d399"],
  ["Affitto / Mutuo", "NEEDS", "#3b82f6"], ["Bollette", "NEEDS", "#60a5fa"],
  ["Spesa alimentare", "NEEDS", "#2563eb"], ["Trasporti", "NEEDS", "#1d4ed8"],
  ["Salute", "NEEDS", "#0ea5e9"], ["Assicurazioni", "NEEDS", "#0284c7"],
  ["Tasse e bolli", "NEEDS", "#0369a1"], ["Rate e finanziamenti", "NEEDS", "#1e40af"],
  ["Ristoranti e bar", "WANTS", "#f59e0b"], ["Svago", "WANTS", "#fbbf24"],
  ["Shopping", "WANTS", "#f97316"], ["Viaggi", "WANTS", "#ea580c"],
  ["Abbonamenti", "WANTS", "#d97706"],
  ["Risparmio", "SAVINGS", "#059669"], ["Investimenti", "SAVINGS", "#047857"],
];

/** Impostazioni, categorie e un conto di partenza per un utente (idempotente). */
export async function ensureUserDefaults(userId: string) {
  await db.settings.upsert({ where: { userId }, update: {}, create: { userId } });
  if ((await db.category.count({ where: { userId } })) === 0) {
    await db.category.createMany({ data: DEFAULT_CATEGORIES.map(([name, bucket, color]) => ({ name, bucket, color, userId })) });
  }
  if ((await db.account.count({ where: { userId } })) === 0) {
    await db.account.create({ data: { name: "Conto corrente", kind: "CHECKING", userId } });
  }
}
