import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatEUR, monthRange } from "@/lib/money";
import { addMonths } from "@/lib/recurrence";
import { compute503020, type Bucket } from "@/lib/rule503020";
import { incomeBase, monthSummary } from "@/lib/queries";
import { contributeGoal, deleteGoal, saveBudget, saveGoal, saveIncomeBase } from "@/server/actions";
import { BUCKET_COLOR, BUCKET_LABEL, Field, PageHeader, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const BUCKETS: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];
const SUB: Record<Bucket, string> = { NEEDS: "Affitto, bollette, spesa, trasporti…", WANTS: "Svago, ristoranti, shopping…", SAVINGS: "Quello che metti da parte" };

type Status = { tone: "ok" | "warn" | "over"; label: string; detail: string };
function statusOf(bucket: Bucket, spent: number, target: number): Status {
  if (bucket === "SAVINGS") {
    return spent >= target
      ? { tone: "ok", label: "Obiettivo raggiunto", detail: spent > target ? `+${formatEUR(spent - target)} oltre il target` : "Hai risparmiato quanto previsto" }
      : { tone: "warn", label: "Da completare", detail: `Mancano ${formatEUR(target - spent)}` };
  }
  if (spent > target) return { tone: "over", label: "Sforato", detail: `${formatEUR(spent - target)} oltre il limite` };
  if (target > 0 && spent / target >= 0.9) return { tone: "warn", label: "Quasi al limite", detail: `Restano ${formatEUR(target - spent)}` };
  return { tone: "ok", label: "Nei limiti", detail: `Restano ${formatEUR(target - spent)}` };
}
const TONE = {
  ok: { pill: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-200", icon: CheckCircle2 },
  warn: { pill: "bg-amber-50 text-amber-700", ring: "ring-amber-200", icon: AlertTriangle },
  over: { pill: "bg-rose-50 text-rose-700", ring: "ring-rose-300", icon: AlertTriangle },
} as const;

export default async function Budget({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { id: userId } = await requireUser();
  const sp = await searchParams;
  const ref = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? new Date(+sp.month!.slice(0, 4), +sp.month!.slice(5) - 1, 1) : new Date();
  const { start, end } = monthRange(ref);
  const thisMonth = key(start) === key(new Date());

  const [settings, cats, budgets, goals, sum] = await Promise.all([
    db.settings.findUniqueOrThrow({ where: { userId } }),
    db.category.findMany({ where: { userId, bucket: { not: "INCOME" } }, orderBy: [{ bucket: "asc" }, { name: "asc" }] }),
    db.budget.findMany({ where: { category: { userId } } }),
    db.savingsGoal.findMany({ where: { userId, archived: false }, orderBy: { dueDate: "asc" } }),
    monthSummary(userId, start, end),
  ]);
  const base = incomeBase(settings.incomeBase, sum.income);
  const fixedBase = settings.incomeBase > 0;
  const report = compute503020(base, sum.spent, { needs: settings.needsPct, wants: settings.wantsPct, savings: settings.savingsPct });
  const bmap = new Map(budgets.map((b) => [b.categoryId, b.monthly]));
  const totalSpent = BUCKETS.reduce((s, b) => s + sum.spent[b], 0);
  const unassigned = base - totalSpent;
  const now = new Date();

  return (
    <>
      <PageHeader title="Regola 50/30/20" subtitle="Come dividi il tuo stipendio tra bisogni, desideri e risparmio">
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <Link href={`/budget?month=${key(addMonths(start, -1, 1))}`} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Mese precedente"><ChevronLeft size={18} /></Link>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize">{start.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
          {thisMonth ? <span className="p-2 opacity-30"><ChevronRight size={18} /></span>
            : <Link href={`/budget?month=${key(addMonths(start, 1, 1))}`} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Mese successivo"><ChevronRight size={18} /></Link>}
        </div>
      </PageHeader>

      {/* Stipendio e suddivisione */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-xl md:p-8">
        <div className="text-sm text-white/60">{fixedBase ? "Stipendio di riferimento" : "Entrate del mese"}</div>
        <div className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{formatEUR(base)}</div>
        {base > 0 ? (
          <>
            <div className="mt-5 flex h-4 overflow-hidden rounded-full ring-1 ring-white/20">
              {report.map((r) => <div key={r.bucket} style={{ width: `${r.targetPct}%`, background: BUCKET_COLOR[r.bucket] }} title={`${BUCKET_LABEL[r.bucket]} ${r.targetPct}%`} />)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs md:text-sm">
              {report.map((r) => (
                <div key={r.bucket}>
                  <div className="flex items-center gap-1.5 text-white/70"><span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLOR[r.bucket] }} />{BUCKET_LABEL[r.bucket]} {r.targetPct}%</div>
                  <div className="font-semibold">{formatEUR(r.target)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/70">Nessuna entrata registrata in questo mese. Registra lo stipendio in <Link href="/transactions" className="underline">Movimenti</Link>, oppure imposta qui sotto uno stipendio di riferimento fisso.</p>
        )}
      </section>

      {/* Le tre fasce */}
      {base > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {report.map((r) => {
            const st = statusOf(r.bucket, r.spent, r.target);
            const T = TONE[st.tone];
            const Icon = T.icon;
            const pct = r.target > 0 ? (r.spent / r.target) * 100 : 0;
            const rows = [
              ...cats.filter((c) => c.bucket === r.bucket).map((c) => ({ name: c.name, color: c.color, value: sum.byCategory.get(c.id) ?? 0 })),
              ...(r.bucket === "WANTS" && sum.uncategorized > 0 ? [{ name: "Senza categoria", color: "#94a3b8", value: sum.uncategorized }] : []),
              ...(r.bucket === "SAVINGS" && sum.savingsTransfers > 0 ? [{ name: "Trasferimenti su conti risparmio", color: "#0d9488", value: sum.savingsTransfers }] : []),
            ].filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
            return (
              <section key={r.bucket} className={`card space-y-4 ring-2 ${T.ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: BUCKET_COLOR[r.bucket] }} /><h2 className="text-lg font-bold">{BUCKET_LABEL[r.bucket]}</h2><span className="text-sm text-slate-400">{r.targetPct}%</span></div>
                    <p className="mt-0.5 text-xs text-slate-400">{SUB[r.bucket]}</p>
                  </div>
                  <span className={`pill gap-1 ${T.pill}`}><Icon size={12} />{st.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><div className="label !mb-0">{r.bucket === "SAVINGS" ? "Da mettere da parte" : "Budget"}</div><div className="text-xl font-bold">{formatEUR(r.target)}</div></div>
                  <div><div className="label !mb-0">{r.bucket === "SAVINGS" ? "Risparmiato" : "Speso"}</div><div className={`text-xl font-bold ${st.tone === "over" ? "text-rose-600" : ""}`}>{formatEUR(r.spent)}</div></div>
                </div>

                <div>
                  <Progress pct={pct} over={st.tone === "over"} color={BUCKET_COLOR[r.bucket]} />
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className={st.tone === "over" ? "font-semibold text-rose-600" : st.tone === "warn" ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>{st.detail}</span>
                    <span className="text-slate-400">{r.actualPct.toFixed(0)}% dello stipendio</span>
                  </div>
                </div>

                <details>
                  <summary className="btn-ghost cursor-pointer">Dettaglio ({rows.length})</summary>
                  {rows.length === 0 ? <p className="mt-2 text-xs text-slate-400">Nessun movimento in questa fascia.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">
                      {rows.map((x) => (
                        <li key={x.name} className="flex items-center justify-between py-1.5">
                          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.name}</span>
                          <span className="font-medium">{formatEUR(x.value)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </section>
            );
          })}
        </div>
      )}

      {base > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">Spese + risparmio: <b className="text-slate-800">{formatEUR(totalSpent)}</b> su {formatEUR(base)}</span>
          <span className={unassigned >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
            {unassigned >= 0 ? `Ancora da assegnare: ${formatEUR(unassigned)}` : `Sei ${formatEUR(-unassigned)} oltre lo stipendio`}
          </span>
        </section>
      )}

      {/* Stipendio di riferimento */}
      <details className="card">
        <summary className="h2 cursor-pointer">Stipendio di riferimento</summary>
        <p className="mt-2 text-xs text-slate-500">Se lo imposti, il 50/30/20 si calcola su questo importo anche prima che arrivi lo stipendio. Lascia vuoto per usare le entrate registrate nel mese.</p>
        <form action={saveIncomeBase} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 sm:flex-none"><Field label="Importo mensile (€)"><input name="incomeBase" inputMode="decimal" defaultValue={fixedBase ? (settings.incomeBase / 100).toFixed(2).replace(".", ",") : ""} placeholder="es. 2000,00" className="input" /></Field></div>
          <button className="btn">Salva</button>
        </form>
      </details>

      {/* Obiettivi di risparmio */}
      <section className="card space-y-4">
        <h2 className="h2 flex items-center gap-2"><Target size={18} /> Obiettivi di risparmio</h2>
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

      {/* Limiti per categoria (facoltativi) */}
      <details className="card">
        <summary className="h2 cursor-pointer">Limiti per singola categoria (facoltativo)</summary>
        <div className="mt-3 space-y-3">
          {cats.map((c) => {
            const limit = bmap.get(c.id) ?? 0;
            const used = sum.byCategory.get(c.id) ?? 0;
            return (
              <form key={c.id} action={saveBudget} className="grid items-center gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
                <input type="hidden" name="categoryId" value={c.id} />
                <div className="text-sm"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: BUCKET_COLOR[c.bucket] }} />{c.name}<span className="ml-1 text-xs text-slate-400">{BUCKET_LABEL[c.bucket]}</span></div>
                <div>{limit > 0 ? <><Progress pct={(used / limit) * 100} over={used > limit} /><div className="mt-1 text-xs text-slate-500">{formatEUR(used)} su {formatEUR(limit)}</div></> : <div className="text-xs text-slate-400">Speso: {formatEUR(used)} · nessun limite</div>}</div>
                <input name="monthly" defaultValue={limit ? (limit / 100).toFixed(2).replace(".", ",") : ""} placeholder="Limite €" className="input sm:w-28" />
                <button className="btn-ghost">Salva</button>
              </form>
            );
          })}
        </div>
      </details>
    </>
  );
}
