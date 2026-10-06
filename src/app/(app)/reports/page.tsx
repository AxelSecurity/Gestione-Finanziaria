import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatEUR } from "@/lib/money";
import { MonthlyBars } from "@/components/charts";
import { BUCKET_LABEL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Reports({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { id: userId } = await requireUser();
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const tx = await db.transaction.findMany({
    where: { userId, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }, type: { in: ["INCOME", "EXPENSE"] } },
    include: { category: true },
  });
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(year, i, 1).toLocaleDateString("it-IT", { month: "short" }), income: 0, expense: 0,
  }));
  const cats = new Map<string, { name: string; bucket: string; total: number }>();
  for (const t of tx) {
    const m = months[t.date.getMonth()];
    if (t.type === "INCOME") m.income += t.amount;
    else {
      m.expense += t.amount;
      const k = t.category?.id ?? "none";
      const c = cats.get(k) ?? { name: t.category?.name ?? "Senza categoria", bucket: t.category?.bucket ?? "WANTS", total: 0 };
      c.total += t.amount; cats.set(k, c);
    }
  }
  const inc = months.reduce((s, m) => s + m.income, 0), exp = months.reduce((s, m) => s + m.expense, 0);
  const rows = [...cats.values()].sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="h1">Report {year}</h1>
        <div className="flex gap-2 text-sm"><a className="btn-ghost" href={`/reports?year=${year - 1}`}>← {year - 1}</a><a className="btn-ghost" href={`/reports?year=${year + 1}`}>{year + 1} →</a></div>
      </div>
      <section className="card"><MonthlyBars data={months} />
        <p className="mt-2 text-sm text-slate-600">Entrate {formatEUR(inc)} · Uscite {formatEUR(exp)} · Tasso di risparmio {inc > 0 ? (((inc - exp) / inc) * 100).toFixed(0) : 0}%</p></section>
      <section className="card">
        <h2 className="h2 mb-2">Spese per categoria</h2>
        <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
          {rows.map((r) => <tr key={r.name}><td className="py-2">{r.name}<span className="ml-2 text-xs text-slate-400">{BUCKET_LABEL[r.bucket]}</span></td><td className="text-right text-slate-500">{exp ? ((r.total / exp) * 100).toFixed(0) : 0}%</td><td className="text-right font-medium">{formatEUR(r.total)}</td></tr>)}
        </tbody></table>
      </section>
    </>
  );
}
