"use client";
import { useState } from "react";

export function TargetsForm({ action, defaults }: { action: (f: FormData) => void; defaults: [number, number, number] }) {
  const [v, setV] = useState(defaults);
  const sum = v[0] + v[1] + v[2];
  const set = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => setV(v.map((x, j) => (j === i ? Number(e.target.value) : x)) as [number, number, number]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      {["needsPct:Bisogni %", "wantsPct:Desideri %", "savingsPct:Risparmio %"].map((x, i) => {
        const [name, label] = x.split(":");
        return <div key={name}><label className="label">{label}</label><input name={name} type="number" min={0} max={100} value={v[i]} onChange={set(i)} className="input" /></div>;
      })}
      <div className="flex flex-col justify-end gap-1">
        <button className="btn w-full" disabled={sum !== 100}>Salva</button>
        <span className={`text-[11px] ${sum === 100 ? "text-slate-400" : "text-rose-600"}`}>Totale {sum}% {sum !== 100 && "(deve essere 100)"}</span>
      </div>
    </form>
  );
}
