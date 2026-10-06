import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatEUR } from "@/lib/money";
import { balances, residualDebt } from "@/server/services";
import { deleteHolding, saveHolding, snapshotNow, updateHoldingPrice } from "@/server/actions";
import { Field, Stat } from "@/components/ui";
import { NetWorthLine } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function Investments() {
  const { id: userId } = await requireUser();
  const [holdings, snaps, bal, loans] = await Promise.all([
    db.holding.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.netWorthSnapshot.findMany({ where: { userId }, orderBy: { month: "asc" }, take: 24 }),
    balances(userId),
    db.loan.findMany({ where: { userId }, include: { deadlines: { where: { paid: false } } } }),
  ]);
  const value = (h: (typeof holdings)[number]) => Math.round(h.quantity * h.currentPrice);
  const invested = holdings.reduce((s, h) => s + Math.round(h.quantity * h.avgPrice), 0);
  const current = holdings.reduce((s, h) => s + value(h), 0);
  const debt = loans.reduce((s, l) => s + residualDebt(l.deadlines.length, l.principal, l.annualRate, l.totalRates, l.installment), 0);
  const net = bal.total + current - debt;
  const pnl = current - invested;

  return (
    <>
      <PageHeader title="Patrimonio e investimenti" subtitle="Liquidità, portafoglio e debiti" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Patrimonio netto" value={net} />
        <Stat label="Liquidità" value={bal.total} />
        <Stat label="Investimenti" value={current} tone={pnl >= 0 ? "pos" : "neg"} />
        <Stat label="Debiti residui" value={debt} tone="neg" />
      </div>

      <section className="card">
        <div className="mb-2 flex justify-between"><h2 className="h2">Andamento patrimonio netto</h2>
          <form action={snapshotNow}><button className="btn-ghost">Salva snapshot ora</button></form></div>
        {snaps.length < 2 ? <p className="text-sm text-slate-500">Lo snapshot viene salvato ogni sera; servono almeno 2 mesi di dati.</p>
          : <NetWorthLine data={snaps.map((s) => ({ label: s.month, net: s.cash + s.investments - s.debt }))} />}
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Portafoglio · P&L {pnl >= 0 ? "+" : ""}{formatEUR(pnl)} {invested > 0 && `(${((pnl / invested) * 100).toFixed(1)}%)`}</h2>
        <form action={saveHolding} className="grid gap-3 sm:grid-cols-7">
          <div className="sm:col-span-2"><Field label="Nome"><input name="name" required className="input" placeholder="VWCE" /></Field></div>
          <Field label="Tipo"><select name="kind" className="input"><option>ETF</option><option>STOCK</option><option>CRYPTO</option><option>BOND</option><option>OTHER</option></select></Field>
          <Field label="Quantità"><input name="quantity" required inputMode="decimal" className="input" /></Field>
          <Field label="Prezzo medio €"><input name="avgPrice" required inputMode="decimal" className="input" /></Field>
          <Field label="Prezzo attuale €"><input name="currentPrice" inputMode="decimal" className="input" /></Field>
          <div className="flex items-end"><button className="btn w-full">Aggiungi</button></div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Asset</th><th>Qtà</th><th>Valore</th><th>P&L</th><th>Aggiorna prezzo</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {holdings.map((h) => {
                const p = value(h) - Math.round(h.quantity * h.avgPrice);
                return (
                  <tr key={h.id}>
                    <td className="py-2">{h.name} <span className="text-xs text-slate-400">{h.kind}</span></td>
                    <td>{h.quantity}</td><td>{formatEUR(value(h))}</td>
                    <td className={p >= 0 ? "text-emerald-600" : "text-rose-600"}>{p >= 0 ? "+" : ""}{formatEUR(p)}</td>
                    <td><form action={updateHoldingPrice} className="flex gap-1"><input type="hidden" name="id" value={h.id} /><input name="currentPrice" required inputMode="decimal" defaultValue={(h.currentPrice / 100).toFixed(2).replace(".", ",")} className="input w-24 py-1" /><button className="btn-ghost">OK</button></form></td>
                    <td><form action={deleteHolding.bind(null, h.id)}><button className="btn-ghost">✕</button></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
