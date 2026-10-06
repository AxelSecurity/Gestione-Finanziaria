import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/money";
import { createUser, deleteUser, resetUserPassword, setUserActive, setUserAdmin } from "@/server/user-actions";
import { StateForm } from "@/components/form-state";
import { Field, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Users() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Utenti" subtitle="Ogni utente ha i propri dati, separati dagli altri" />

      <section className="card space-y-3">
        <h2 className="h2">Nuovo utente</h2>
        <StateForm action={createUser} submit="Crea utente" className="grid gap-3 sm:grid-cols-2" resetOnOk>
          <Field label="Nome"><input name="name" required className="input" /></Field>
          <Field label="Email"><input name="email" type="email" required className="input" autoComplete="off" /></Field>
          <Field label="Password iniziale (min 8)"><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="isAdmin" /> Amministratore (può gestire gli utenti)</label>
        </StateForm>
      </section>

      <section className="space-y-3">
        {users.map((u) => {
          const self = u.id === me.id;
          return (
            <div key={u.id} className={`card space-y-3 ${u.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{u.name || u.email} {self && <span className="pill bg-indigo-50 text-indigo-700">tu</span>}</div>
                  <div className="text-xs text-slate-500">{u.email} · creato il {formatDate(u.createdAt)}</div>
                </div>
                <div className="flex gap-1">
                  <span className={`pill ${u.isAdmin ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{u.isAdmin ? "Admin" : "Utente"}</span>
                  <span className={`pill ${u.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{u.active ? "Attivo" : "Disattivato"}</span>
                </div>
              </div>
              {!self && (
                <div className="flex flex-wrap items-end gap-2">
                  <form action={setUserActive.bind(null, u.id, !u.active)}><button className="btn-outline">{u.active ? "Disattiva" : "Riattiva"}</button></form>
                  <form action={setUserAdmin.bind(null, u.id, !u.isAdmin)}><button className="btn-outline">{u.isAdmin ? "Rendi utente" : "Rendi admin"}</button></form>
                  <details className="w-full">
                    <summary className="btn-ghost cursor-pointer">Reimposta password</summary>
                    <StateForm action={resetUserPassword} submit="Imposta" className="mt-2 flex flex-wrap items-end gap-2" resetOnOk>
                      <input type="hidden" name="id" value={u.id} />
                      <div className="min-w-[200px] flex-1"><Field label="Nuova password (min 8)"><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field></div>
                    </StateForm>
                  </details>
                  <details className="w-full">
                    <summary className="btn-ghost cursor-pointer text-rose-600">Elimina utente e dati…</summary>
                    <form action={deleteUser.bind(null, u.id)} className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                      Verranno eliminati definitivamente tutti i suoi movimenti, scadenze e scontrini.
                      <button className="rounded-lg bg-rose-600 px-3 py-2 text-white">Elimina definitivamente</button>
                    </form>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
