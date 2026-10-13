import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatEUR, monthRange } from "@/lib/money";
import { compute503020 } from "@/lib/rule503020";
import { incomeBase, monthSummary } from "@/lib/queries";
import { balances } from "@/server/services";
import { ArrowDownCircle, ArrowUpCircle, PiggyBank } from "lucide-react";
import { BUCKET_COLOR, BUCKET_LABEL, KIND_EMOJI, PageHeader, Progress, Stat } from "@/components/ui";
import { DonutChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { id: userId } = await requireUser();
  const { start, end } = monthRange();
  const [{ income, expense, spent, byCategory }, bal, settings, deadlines, budgets] = await Promise.all([
    monthSummary(userId, start, end),
    balances(userId),
    db.settings.findUniqueOrThrow({ where: { userId } }),
    db.deadline.findMany({ where: { userId, paid: false }, orderBy: { dueDate: "asc" }, take: 5 }),
    db.budget.findMany({ where: { category: { userId } }, include: { category: true } }),
  ]);
  const base = incomeBase(settings.incomeBase, income);
  const report = compute503020(base, spent, { needs: settings.needsPct, wants: settings.wantsPct, savings: settings.savingsPct });
  const risk = budgets
    .map((b) => ({ ...b, used: byCategory.get(b.categoryId) ?? 0 }))
    .filter((b) => b.used / b.monthly >= 0.8)
    .sort((a, b) => b.used / b.monthly - a.used / a.monthly);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const free = income - expense;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={start.toLocaleDateString("it-IT", { month: "long", year: "numeric" })} />
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-700 p-6 text-white shadow-xl shadow-teal-700/20 md:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative">
          <div className="text-sm text-white/70">Saldo totale</div>
          <div className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{formatEUR(bal.total)}</div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1">▲ Entrate {formatEUR(income)}</span>
            <span className="rounded-full bg-white/20 px-3 py-1">▼ Uscite {formatEUR(expense)}</span>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Entrate del mese" value={income} tone="pos" icon={<ArrowDownCircle size={16} />} />
        <Stat label="Uscite del mese" value={expense} tone="neg" icon={<ArrowUpCircle size={16} />} />
        <Stat label="Risparmio del mese" value={free} tone={free >= 0 ? "indigo" : "neg"} icon={<PiggyBank size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-3">Regola {settings.needsPct}/{settings.wantsPct}/{settings.savingsPct}</h2>
          {base <= 0 ? (
            <p className="text-sm text-slate-500">Registra le entrate del mese per vedere la ripartizione.</p>
          ) : (
            <div className="space-y-4">
              {report.map((r) => (
                <div key={r.bucket}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{BUCKET_LABEL[r.bucket]} <span className="text-slate-400">({r.actualPct.toFixed(0)}% / {r.targetPct}%)</span></span>
                    <span className={r.over ? "text-rose-600" : "text-slate-600"}>{formatEUR(r.spent)} / {formatEUR(r.target)}</span>
                  </div>
                  <Progress pct={r.target ? (r.spent / r.target) * 100 : 0} over={r.bucket !== "SAVINGS" && r.over} color={BUCKET_COLOR[r.bucket]} />
                  <p className="mt-1 text-xs text-slate-500">
                    {r.bucket === "SAVINGS"
                      ? r.over ? `Ti mancano ${formatEUR(r.remaining)} per raggiungere l'obiettivo di risparmio.` : "Obiettivo di risparmio raggiunto 🎉"
                      : r.over ? `Hai sforato di ${formatEUR(-r.remaining)}.` : `Ti restano ${formatEUR(r.remaining)}.`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <h2 className="h2 mb-3">Come spendi</h2>
          {expense > 0 ? (
            <DonutChart data={report.map((r) => ({ name: BUCKET_LABEL[r.bucket], value: r.spent, color: BUCKET_COLOR[r.bucket] })).filter((d) => d.value > 0)} />
          ) : <p className="text-sm text-slate-500">Nessuna spesa registrata questo mese.</p>}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex justify-between"><h2 className="h2">Prossime scadenze</h2><Link href="/deadlines" className="text-xs text-brand-dark">Tutte →</Link></div>
          {deadlines.length === 0 && <p className="text-sm text-slate-500">Nessuna scadenza in programma.</p>}
          <ul className="divide-y divide-slate-100">
            {deadlines.map((d) => {
              const late = d.dueDate < now;
              return (
                <li key={d.id} className="flex justify-between py-2 text-sm">
                  <span>{KIND_EMOJI[d.kind]} {d.title}<span className={`block text-xs ${late ? "text-rose-600" : "text-slate-400"}`}>{late ? "Scaduta · " : ""}{formatDate(d.dueDate)}</span></span>
                  <span className="h2">{formatEUR(d.amount)}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card">
          <div className="mb-3 flex justify-between"><h2 className="h2">Budget a rischio</h2><Link href="/budget" className="text-xs text-brand-dark">Budget →</Link></div>
          {risk.length === 0 && <p className="text-sm text-slate-500">Tutto sotto controllo.</p>}
          <div className="space-y-3">
            {risk.map((b) => (
              <div key={b.id}>
                <div className="flex justify-between text-sm"><span>{b.category.name}</span><span>{formatEUR(b.used)} / {formatEUR(b.monthly)}</span></div>
                <Progress pct={(b.used / b.monthly) * 100} over={b.used > b.monthly} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
