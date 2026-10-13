import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Export completo JSON (backup logico). ?format=csv per le sole transazioni. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const where = { userId: user.id };
  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    const tx = await db.transaction.findMany({ where, include: { category: true, account: true, toAccount: true }, orderBy: { date: "asc" } });
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = tx.map((t) => [t.date.toISOString().slice(0, 10), t.type, (t.amount / 100).toFixed(2), esc(t.account.name), esc(t.toAccount?.name ?? ""), esc(t.category?.name ?? ""), esc(t.note)].join(";"));
    return new Response(["data;tipo;importo;conto;verso_conto;categoria;nota", ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="transazioni.csv"' },
    });
  }
  const data = {
    exportedAt: new Date().toISOString(),
    accounts: await db.account.findMany({ where }), categories: await db.category.findMany({ where }),
    transactions: await db.transaction.findMany({ where }), recurring: await db.recurringRule.findMany({ where }),
    budgets: await db.budget.findMany({ where: { category: where } }), goals: await db.savingsGoal.findMany({ where }),
    deadlines: await db.deadline.findMany({ where }), deadlineDocuments: await db.deadlineDocument.findMany({ where }), loans: await db.loan.findMany({ where }),
    holdings: await db.holding.findMany({ where }), snapshots: await db.netWorthSnapshot.findMany({ where }),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="backup.json"' },
  });
}
