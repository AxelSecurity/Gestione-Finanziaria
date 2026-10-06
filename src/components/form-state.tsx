"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/server/user-actions";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

/** Form con messaggio di esito. Non svuota i campi in caso di errore (React 19 lo farebbe con `action=`); li svuota solo con esito ok se `resetOnOk`. */
export function StateForm({ action, children, submit, className = "space-y-3", resetOnOk = false }: {
  action: Action; children: React.ReactNode; submit: string; className?: string; resetOnOk?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (resetOnOk && state?.ok) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      {children}
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn" disabled={pending}>{pending ? "Attendi…" : submit}</button>
    </form>
  );
}
