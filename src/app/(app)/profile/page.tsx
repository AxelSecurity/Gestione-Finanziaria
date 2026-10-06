import Link from "next/link";
import { requireUser } from "@/lib/session";
import { changePassword, updateProfile } from "@/server/user-actions";
import { logoutAction } from "@/server/actions";
import { StateForm } from "@/components/form-state";
import { Field, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Il mio profilo" subtitle={user.isAdmin ? "Amministratore" : "Utente"} />

      <section className="card space-y-3">
        <h2 className="h2">Dati personali</h2>
        <StateForm action={updateProfile} submit="Salva profilo" className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome visualizzato"><input name="name" required defaultValue={user.name} className="input" autoComplete="name" /></Field>
          <Field label="Email di accesso"><input name="email" type="email" required defaultValue={user.email} className="input" autoComplete="username" /></Field>
          <div className="sm:col-span-2"><Field label="Password attuale (solo se cambi email)"><input name="currentPassword" type="password" className="input" autoComplete="current-password" /></Field></div>
        </StateForm>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Cambia password</h2>
        <p className="text-xs text-slate-500">Dopo il cambio verrai disconnesso da tutti i dispositivi e dovrai rientrare.</p>
        <StateForm action={changePassword} submit="Cambia password" className="grid gap-3 sm:grid-cols-3">
          <Field label="Password attuale"><input name="currentPassword" type="password" required className="input" autoComplete="current-password" /></Field>
          <Field label="Nuova password (min 8)"><input name="newPassword" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
          <Field label="Conferma nuova password"><input name="confirmPassword" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
        </StateForm>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">Notifiche, conti, categorie e percentuali 50/30/20 si gestiscono in <Link href="/settings" className="font-medium text-emerald-700">Impostazioni</Link>.</div>
        <div className="flex gap-2">
          {user.isAdmin && <Link href="/users" className="btn-outline">Gestisci utenti</Link>}
          <form action={logoutAction}><button className="btn-outline">Esci</button></form>
        </div>
      </section>
    </>
  );
}
