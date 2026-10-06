"use client";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { loginAction } from "@/server/actions";

function Changed() {
  return useSearchParams().get("changed") ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password cambiata: accedi con quella nuova.</p> : null;
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2 text-lg font-semibold"><Wallet /> Finanza</div>
        <div className="relative space-y-4">
          <h2 className="text-4xl font-bold leading-tight">Tieni sotto controllo<br />entrate, uscite e scadenze.</h2>
          <p className="max-w-md text-white/80">Regola 50/30/20, budget, obiettivi di risparmio e uno scadenzario che non ti fa dimenticare niente.</p>
          <div className="flex gap-2 pt-2 text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1">50% Bisogni</span><span className="rounded-full bg-white/20 px-3 py-1">30% Desideri</span><span className="rounded-full bg-white/20 px-3 py-1">20% Risparmio</span>
          </div>
        </div>
        <div className="relative text-xs text-white/60">I tuoi dati restano sul tuo server.</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form action={action} className="card w-full max-w-sm space-y-4 p-7">
          <div><h1 className="h1 !text-2xl">Bentornato 👋</h1><p className="text-sm text-slate-500">Accedi per gestire le tue finanze.</p></div>
          <div><label className="label">Email</label><input name="email" type="email" required className="input" autoComplete="username" defaultValue={state?.email} key={state?.email} /></div>
          <div><label className="label">Password</label><input name="password" type="password" required className="input" autoComplete="current-password" /></div>
          <Suspense><Changed /></Suspense>
          {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
          <button className="btn w-full py-2.5" disabled={pending}>{pending ? "Accesso…" : "Accedi"}</button>
        </form>
      </section>
    </main>
  );
}
