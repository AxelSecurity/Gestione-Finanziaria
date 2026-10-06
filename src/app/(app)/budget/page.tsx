import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatEUR, monthRange } from "@/lib/money";
import { monthSummary } from "@/lib/queries";
import { contributeGoal, deleteGoal, saveBudget, saveGoal } from "@/server/actions";
import { BUCKET_COLOR, BUCKET_LABEL, Field, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Budget() {
  const { id: userId } = await requireUser();
  const { start, end } = monthRange();
  const [cats, budgets, goals, { byCategory }] = await Promise.all([
    db.category.findMany({ where: { userId, bucket: { not: "INCOME" } }, orderBy: [{ bucket: "asc" }, { name: "asc" }] }),
    db.budget.findMany({ where: { category: { userId } } }),
    db.savingsGoal.findMany({ where: { userId, archived: false }, orderBy: { dueDate: "asc" } }),
    monthSummary(userId, start, end),
  ]);
  const bmap = new Map(budgets.map((b) => [b.categoryId, b.monthly]));
  const now = new Date();

  return (
    <>
      <PageHeader title="Budget e obiettivi" subtitle="Limiti per categoria e salvadanai" />
      <section className="card space-y-4">
        <h2 className="h2">Budget mensile per categoria</h2>
        {cats.map((c) => {
          const limit = bmap.get(c.id) ?? 0;
          const used = byCategory.get(c.id) ?? 0;
          return (
            <form key={c.id} action={saveBudget} className="grid items-center gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
              <input type="hidden" name="categoryId" value={c.id} />
              <div className="text-sm"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: BUCKET_COLOR[c.bucket] }} />{c.name}<span className="ml-1 text-xs text-slate-400">{BUCKET_LABEL[c.bucket]}</span></div>
              <div>{limit > 0 ? <><Progress pct={(used / limit) * 100} over={used > limit} /><div className="mt-1 text-xs text-slate-500">{formatEUR(used)} su {formatEUR(limit)}</div></> : <div className="text-xs text-slate-400">Speso: {formatEUR(used)} · nessun limite</div>}</div>
              <input name="monthly" defaultValue={limit ? (limit / 100).toFixed(2).replace(".", ",") : ""} placeholder="Limite €" className="input w-28" />
              <button className="btn-ghost">Salva</button>
            </form>
          );
        })}
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Obiettivi di risparmio</h2>
        <form action={saveGoal} className="grid gap-3 sm:grid-cols-4">
          <Field label="Nome"><input name="name" required className="input" placeholder="Vacanza, fondo emergenza…" /></Field>
          <Field label="Obiettivo (€)"><input name="target" required inputMode="decimal" className="input" /></Field>
          <Field label="Entro (opz.)"><input name="dueDate" type="date" className="input" /></Field>
          <div className="flex items-end"><button className="btn w-full">Crea obiettivo</button></div>
        </form>
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const left = Math.max(0, g.target - g.saved);
            let monthly = 0;
            if (g.dueDate && left > 0) {
              const months = Math.max(1, (g.dueDate.getFullYear() - now.getFullYear()) * 12 + g.dueDate.getMonth() - now.getMonth());
              monthly = Math.ceil(left / months);
            }
            return (
              <div key={g.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between"><b>{g.name}</b><form action={deleteGoal.bind(null, g.id)}><button className="btn-ghost">Elimina</button></form></div>
                <div className="my-2"><Progress pct={(g.saved / g.target) * 100} /></div>
                <div className="text-sm text-slate-600">{formatEUR(g.saved)} / {formatEUR(g.target)}</div>
                {g.dueDate && <div className="text-xs text-slate-500">Entro {formatDate(g.dueDate)}{monthly > 0 && <> · consigliati <b>{formatEUR(monthly)}</b>/mese</>}</div>}
                <form action={contributeGoal} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input name="amount" required inputMode="decimal" placeholder="Versa €" className="input" />
                  <button className="btn">Versa</button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
