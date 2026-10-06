import { TargetsForm } from "@/components/targets-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatEUR } from "@/lib/money";
import { archiveAccount, deleteCategory, runNotifyNow, saveAccount, saveCategory, saveNotifyPrefs, saveTargets, sendTestNotification } from "@/server/actions";
import { balances } from "@/server/services";
import { BUCKET_LABEL, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { id: userId } = await requireUser();
  const [s, cats, bal] = await Promise.all([
    db.settings.findUniqueOrThrow({ where: { userId } }),
    db.category.findMany({ where: { userId }, orderBy: [{ bucket: "asc" }, { name: "asc" }] }),
    balances(userId),
  ]);
  async function test() { "use server"; await sendTestNotification(); }
  async function now() { "use server"; await runNotifyNow(); }
  const user = await requireUser();
  const tgReady = !!process.env.TELEGRAM_BOT_TOKEN;
  const mailReady = !!process.env.SMTP_HOST;
  const tg = tgReady && !!(s.telegramChatId || (user.isAdmin && process.env.TELEGRAM_CHAT_ID));
  const mail = mailReady;

  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Conti, categorie, notifiche e backup" />

      <section className="card space-y-3">
        <h2 className="h2">Conti</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {bal.accounts.map((a) => (
            <li key={a.id} className="flex justify-between py-2"><span>{a.name} <span className="text-xs text-slate-400">{a.kind}</span></span>
              <span className="flex items-center gap-2">{formatEUR(bal.byId[a.id])}<form action={archiveAccount.bind(null, a.id)}><button className="btn-ghost">Archivia</button></form></span></li>
          ))}
        </ul>
        <form action={saveAccount} className="grid gap-3 sm:grid-cols-4">
          <Field label="Nome"><input name="name" required className="input" /></Field>
          <Field label="Tipo"><select name="kind" className="input"><option value="CHECKING">Conto corrente</option><option value="CASH">Contanti</option><option value="CARD">Carta</option><option value="SAVINGS">Risparmio</option><option value="INVESTMENT">Investimento</option></select></Field>
          <Field label="Saldo iniziale (€)"><input name="initialBalance" inputMode="decimal" className="input" defaultValue="0" /></Field>
          <div className="flex items-end"><button className="btn w-full">Aggiungi conto</button></div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Percentuali 50/30/20</h2>
        <TargetsForm action={saveTargets} defaults={[s.needsPct, s.wantsPct, s.savingsPct]} />
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Categorie</h2>
        <form action={saveCategory} className="grid gap-3 sm:grid-cols-4">
          <Field label="Nome"><input name="name" required className="input" /></Field>
          <Field label="Gruppo"><select name="bucket" className="input">{Object.entries(BUCKET_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Colore"><input name="color" type="color" defaultValue="#64748b" className="input h-10 p-1" /></Field>
          <div className="flex items-end"><button className="btn w-full">Aggiungi</button></div>
        </form>
        <div className="flex flex-wrap gap-2 text-xs">
          {cats.map((c) => (
            <form key={c.id} action={deleteCategory.bind(null, c.id)} className="flex items-center gap-1 rounded-full px-3 py-1 text-white" style={{ background: c.color }}>
              {c.name} · {BUCKET_LABEL[c.bucket]}<button title="Elimina" className="ml-1 opacity-70 hover:opacity-100">✕</button>
            </form>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Notifiche scadenze</h2>
        <p className="text-sm text-slate-500">
          Telegram: {tgReady ? (tg ? "attivo" : "bot configurato, inserisci il tuo Chat ID") : "bot non configurato dall'amministratore"} · Email: {mailReady ? "attiva" : "SMTP non configurato dall'amministratore"}.
        </p>
        <form action={saveNotifyPrefs} className="grid gap-3 sm:grid-cols-2">
          <Field label="Telegram Chat ID"><input name="telegramChatId" defaultValue={s.telegramChatId} inputMode="numeric" placeholder="es. 123456789" className="input" /></Field>
          <Field label="Email per le notifiche"><input name="notifyEmailTo" type="email" defaultValue={s.notifyEmailTo} placeholder={user.email} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notifyTelegram" defaultChecked={s.notifyTelegram} /> Telegram</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notifyEmail" defaultChecked={s.notifyEmail} /> Email</label>
          <div><button className="btn">Salva</button></div>
        </form>
        <div className="flex gap-2"><form action={test}><button className="btn-outline">Invia notifica di test</button></form><form action={now}><button className="btn-outline">Invia promemoria ora</button></form></div>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Backup ed export</h2>
        <div className="flex gap-3 text-sm"><a className="btn" href="/api/export">Backup JSON</a><a className="btn" href="/api/export?format=csv">Transazioni CSV</a></div>
      </section>
    </>
  );
}
