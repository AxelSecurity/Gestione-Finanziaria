import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatEUR, toInputDate } from "@/lib/money";
import { deleteRecurring, deleteTransaction, saveRecurring, saveTransaction, toggleRecurring } from "@/server/actions";
import { Paperclip, Pencil, Trash2 } from "lucide-react";
import { TransactionForm } from "@/components/transaction-form";
import { BUCKET_LABEL, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

type SP = { month?: string; account?: string; category?: string; q?: string; edit?: string };

export default async function Transactions({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { id: userId } = await requireUser();
  const month = sp.month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const [accounts, categories, rules, list] = await Promise.all([
    db.account.findMany({ where: { userId, archived: false } }),
    db.category.findMany({ where: { userId }, orderBy: [{ bucket: "asc" }, { name: "asc" }] }),
    db.recurringRule.findMany({ where: { userId }, include: { category: true }, orderBy: { nextDate: "asc" } }),
    db.transaction.findMany({
      where: {
        userId,
        date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
        ...(sp.account ? { OR: [{ accountId: sp.account }, { toAccountId: sp.account }] } : {}),
        ...(sp.category ? { categoryId: sp.category } : {}),
        ...(sp.q ? { note: { contains: sp.q } } : {}),
      },
      include: { category: true, account: true, toAccount: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const editTx = sp.edit ? await db.transaction.findFirst({ where: { id: sp.edit, userId } }) : null;
  const params = new URLSearchParams(Object.entries({ month: sp.month, account: sp.account, category: sp.category, q: sp.q }).filter(([, v]) => v) as [string, string][]);
  const backHref = `/transactions${params.size ? `?${params}` : ""}`;
  const editHref = (id: string) => `/transactions?${new URLSearchParams([...params, ["edit", id]])}`;
  const today = toInputDate(new Date());
  const catOptions = categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({BUCKET_LABEL[c.bucket]})</option>);
  const accOptions = accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>);

  return (
    <>
      <PageHeader title="Movimenti" subtitle="Entrate, uscite e trasferimenti" />

      <TransactionForm
        key={editTx?.id ?? "new"}
        backHref={backHref}
        initial={editTx ? {
          id: editTx.id, type: editTx.type as "INCOME" | "EXPENSE" | "TRANSFER", amount: (editTx.amount / 100).toFixed(2).replace(".", ","),
          date: toInputDate(editTx.date), accountId: editTx.accountId, toAccountId: editTx.toAccountId ?? "", categoryId: editTx.categoryId ?? "",
          note: editTx.note, hasReceipt: !!editTx.receiptFile,
        } : undefined}
        action={saveTransaction}
        today={today}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, bucketLabel: BUCKET_LABEL[c.bucket] }))}
      />

      <form className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input type="month" name="month" defaultValue={month} className="input sm:w-auto" />
        <select name="account" defaultValue={sp.account ?? ""} className="input sm:w-auto"><option value="">Tutti i conti</option>{accOptions}</select>
        <select name="category" defaultValue={sp.category ?? ""} className="input sm:w-auto"><option value="">Tutte le categorie</option>{catOptions}</select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cerca nota…" className="input sm:w-auto" />
        <button className="btn col-span-2 sm:col-span-1">Filtra</button>
      </form>

      <section className="card p-0">
        {list.length === 0 && <p className="p-5 text-sm text-slate-500">Nessun movimento.</p>}
        <ul className="divide-y divide-slate-100">
          {list.map((t) => {
            const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : "";
            const color = t.type === "INCOME" ? "text-emerald-600" : t.type === "EXPENSE" ? "text-rose-600" : "text-slate-600";
            return (
              <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${editTx?.id === t.id ? "bg-amber-50" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: t.category?.color ?? "#94a3b8" }}>
                  {t.type === "TRANSFER" ? "⇄" : (t.category?.name ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.note || t.category?.name || "Trasferimento"}</div>
                  <div className="truncate text-xs text-slate-400">
                    {formatDate(t.date)} · {t.type === "TRANSFER" ? `${t.account.name} → ${t.toAccount?.name ?? "?"}` : `${t.category?.name ?? "Senza categoria"} · ${t.account.name}`}
                  </div>
                </div>
                <div className={`whitespace-nowrap text-sm font-semibold ${color}`}>{sign}{formatEUR(t.amount)}</div>
                {t.receiptFile && (
                  <a href={`/api/receipts/${t.id}`} target="_blank" rel="noreferrer" title="Vedi scontrino" className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                    <Paperclip size={16} />
                  </a>
                )}
                <Link href={editHref(t.id)} className="btn-ghost" aria-label="Modifica" title="Modifica"><Pencil size={16} /></Link>
                <form action={deleteTransaction.bind(null, t.id)}><button className="btn-ghost" aria-label="Elimina"><Trash2 size={16} /></button></form>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="card space-y-4" open={rules.length > 0}>
        <summary className="h2 cursor-pointer">Movimenti ricorrenti (stipendio, abbonamenti…)</summary>
        <form action={saveRecurring} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2"><Field label="Nome"><input name="name" required className="input" /></Field></div>
          <Field label="Tipo"><select name="type" className="input"><option value="EXPENSE">Uscita</option><option value="INCOME">Entrata</option></select></Field>
          <Field label="Importo (€)"><input name="amount" required inputMode="decimal" className="input" /></Field>
          <Field label="Frequenza"><select name="frequency" className="input"><option value="MONTHLY">Mensile</option><option value="WEEKLY">Settimanale</option><option value="BIMONTHLY">Bimestrale</option><option value="QUARTERLY">Trimestrale</option><option value="YEARLY">Annuale</option></select></Field>
          <Field label="Prossima data"><input name="nextDate" type="date" required defaultValue={today} className="input" /></Field>
          <Field label="Conto"><select name="accountId" className="input">{accOptions}</select></Field>
          <div className="sm:col-span-3"><Field label="Categoria"><select name="categoryId" className="input"><option value="">—</option>{catOptions}</select></Field></div>
          <div className="flex items-end"><button className="btn w-full">Crea</button></div>
        </form>
        <ul className="divide-y divide-slate-100 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className={r.active ? "" : "text-slate-400 line-through"}>{r.name} · {formatEUR(r.amount)} · {r.frequency.toLowerCase()} · prossima {formatDate(r.nextDate)}</span>
              <span className="flex gap-1">
                <form action={toggleRecurring.bind(null, r.id, !r.active)}><button className="btn-ghost">{r.active ? "Sospendi" : "Riattiva"}</button></form>
                <form action={deleteRecurring.bind(null, r.id)}><button className="btn-ghost">Elimina</button></form>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
