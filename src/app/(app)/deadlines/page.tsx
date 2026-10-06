import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatEUR, toInputDate } from "@/lib/money";
import { deleteDeadline, deleteLoan, payDeadline, saveDeadline, saveLoan, unpayDeadline } from "@/server/actions";
import { Field, KIND_LABEL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Deadlines({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const { id: userId } = await requireUser();
  const [accounts, categories, loans] = await Promise.all([
    db.account.findMany({ where: { userId, archived: false } }),
    db.category.findMany({ where: { userId, bucket: { not: "INCOME" } }, orderBy: { name: "asc" } }),
    db.loan.findMany({ where: { userId }, include: { deadlines: true } }),
  ]);
  const horizon = new Date(); horizon.setMonth(horizon.getMonth() + (all ? 24 : 3));
  const [open, paid] = await Promise.all([
    db.deadline.findMany({ where: { userId, paid: false, dueDate: { lte: horizon } }, orderBy: { dueDate: "asc" } }),
    db.deadline.findMany({ where: { userId, paid: true }, orderBy: { paidAt: "desc" }, take: 8 }),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const accOptions = accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>);
  const kinds = Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>);
  const totalOpen = open.reduce((s, d) => s + d.amount, 0);

  // raggruppa per mese
  const groups = new Map<string, typeof open>();
  for (const d of open) {
    const key = d.dueDate < today ? "Scadute" : d.dueDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <>
      <PageHeader title="Scadenzario" subtitle="Bollette, bolli, assicurazioni, rate" />
      <form action={saveDeadline} className="card grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2"><Field label="Descrizione"><input name="title" required className="input" placeholder="Bolletta luce, bollo auto…" /></Field></div>
        <Field label="Tipo"><select name="kind" className="input">{kinds}</select></Field>
        <Field label="Importo (€)"><input name="amount" required inputMode="decimal" className="input" /></Field>
        <Field label="Scadenza"><input name="dueDate" type="date" required defaultValue={toInputDate(new Date())} className="input" /></Field>
        <Field label="Ripeti"><select name="recurrence" className="input"><option value="NONE">Mai</option><option value="MONTHLY">Ogni mese</option><option value="BIMONTHLY">Ogni 2 mesi</option><option value="QUARTERLY">Ogni 3 mesi</option><option value="YEARLY">Ogni anno</option></select></Field>
        <Field label="Promemoria (gg prima)"><input name="remindDaysBefore" type="number" min={0} defaultValue={3} className="input" /></Field>
        <div className="sm:col-span-3"><Field label="Categoria"><select name="categoryId" className="input"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
        <div className="flex items-end sm:col-span-2"><button className="btn w-full">Aggiungi scadenza</button></div>
      </form>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Da pagare nel periodo: <b className="text-slate-800">{formatEUR(totalOpen)}</b></span>
        <a href={all ? "/deadlines" : "/deadlines?all=1"} className="text-brand-dark">{all ? "Mostra 3 mesi" : "Mostra 24 mesi"}</a>
      </div>

      {[...groups].map(([label, items]) => (
        <section key={label} className="card p-0">
          <h2 className={`px-5 pt-4 text-sm font-medium capitalize ${label === "Scadute" ? "text-rose-600" : ""}`}>{label}</h2>
          <ul className="divide-y divide-slate-100">
            {items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <div className="h2">{d.title}</div>
                  <div className="text-xs text-slate-500">{KIND_LABEL[d.kind]} · {formatDate(d.dueDate)}{d.recurrence !== "NONE" && " · ricorrente"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <b>{formatEUR(d.amount)}</b>
                  <form action={payDeadline} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={d.id} />
                    <select name="accountId" className="input w-auto py-1 text-xs">{accOptions}</select>
                    <button className="btn py-1 text-xs">Paga</button>
                  </form>
                  <form action={deleteDeadline.bind(null, d.id)}><button className="btn-ghost">✕</button></form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open.length === 0 && <p className="text-sm text-slate-500">Nessuna scadenza aperta.</p>}

      {paid.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-medium">Pagate di recente</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {paid.map((d) => (
              <li key={d.id} className="flex justify-between py-2 text-slate-500">
                <span>{d.title} · {d.paidAt && formatDate(d.paidAt)}</span>
                <span className="flex items-center gap-2">{formatEUR(d.amount)}<form action={unpayDeadline.bind(null, d.id)}><button className="btn-ghost">Annulla</button></form></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="h2">Mutui e finanziamenti</h2>
        <form action={saveLoan} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2"><Field label="Nome"><input name="name" required className="input" /></Field></div>
          <Field label="Tipo"><select name="kind" className="input"><option value="MUTUO">Mutuo</option><option value="FINANZIAMENTO">Finanziamento</option></select></Field>
          <Field label="Capitale (€)"><input name="principal" required inputMode="decimal" className="input" /></Field>
          <Field label="TAN annuo (%)"><input name="annualRate" required inputMode="decimal" className="input" /></Field>
          <Field label="N° rate"><input name="totalRates" type="number" min={1} required className="input" /></Field>
          <Field label="Rata (€, opz.)"><input name="installment" inputMode="decimal" className="input" placeholder="calcolata" /></Field>
          <Field label="Prima rata"><input name="startDate" type="date" required className="input" /></Field>
          <div className="flex items-end sm:col-span-2"><button className="btn w-full">Crea e genera rate</button></div>
        </form>
        {loans.map((l) => {
          const unpaid = l.deadlines.filter((d) => !d.paid);
          return (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
              <div><b>{l.name}</b> · rata {formatEUR(l.installment)} · TAN {l.annualRate}%<div className="text-xs text-slate-500">{l.totalRates - unpaid.length}/{l.totalRates} rate pagate · {unpaid.length} rimanenti{unpaid[0] && <> · prossima {formatDate(unpaid.sort((a, b) => +a.dueDate - +b.dueDate)[0].dueDate)}</>}</div></div>
              <form action={deleteLoan.bind(null, l.id)}><button className="btn-ghost">Elimina</button></form>
            </div>
          );
        })}
      </section>
    </>
  );
}
