"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-16 max-w-md space-y-3 text-center">
      <div className="text-3xl">😕</div>
      <h2 className="h2">Qualcosa è andato storto</h2>
      <p className="text-sm text-slate-500">Operazione non riuscita. Controlla i dati inseriti e riprova.</p>
      <button className="btn" onClick={reset}>Riprova</button>
    </div>
  );
}
