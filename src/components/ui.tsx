import { formatEUR } from "@/lib/money";

type Tone = "pos" | "neg" | "brand" | "indigo" | "amber";
const TONES: Record<Tone, { bar: string; text: string }> = {
  pos: { bar: "from-emerald-400 to-emerald-600", text: "text-emerald-600" },
  neg: { bar: "from-rose-400 to-rose-600", text: "text-rose-600" },
  brand: { bar: "from-teal-400 to-cyan-600", text: "text-slate-900" },
  indigo: { bar: "from-indigo-400 to-violet-600", text: "text-slate-900" },
  amber: { bar: "from-amber-400 to-orange-500", text: "text-slate-900" },
};

export function Stat({ label, value, tone = "brand", icon }: { label: string; value: number; tone?: Tone; icon?: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className="card relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">{label}{icon && <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${t.bar} text-white`}>{icon}</span>}</div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${t.text}`}>{formatEUR(value)}</div>
    </div>
  );
}

export function Progress({ pct, over, color = "#10b981" }: { pct: number; over?: boolean; color?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: over ? "linear-gradient(90deg,#fb7185,#e11d48)" : color }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="h1">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
      {children}
    </div>
  );
}

export const BUCKET_LABEL: Record<string, string> = { NEEDS: "Bisogni", WANTS: "Desideri", SAVINGS: "Risparmio", INCOME: "Entrate" };
export const BUCKET_COLOR: Record<string, string> = { NEEDS: "#3b82f6", WANTS: "#f59e0b", SAVINGS: "#10b981", INCOME: "#64748b" };
export const KIND_LABEL: Record<string, string> = {
  BOLLETTA: "Bolletta", BOLLO: "Bollo", ASSICURAZIONE: "Assicurazione", MUTUO: "Mutuo", FINANZIAMENTO: "Finanziamento", ALTRO: "Altro",
};
export const KIND_EMOJI: Record<string, string> = { BOLLETTA: "💡", BOLLO: "🚗", ASSICURAZIONE: "🛡️", MUTUO: "🏠", FINANZIAMENTO: "💳", ALTRO: "📌" };

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
