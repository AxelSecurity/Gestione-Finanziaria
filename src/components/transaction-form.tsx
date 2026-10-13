"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, Loader2, X, ScanLine, Paperclip } from "lucide-react";
import { scanImage } from "@/lib/scan-image";
import { recognize } from "@/lib/ocr";
import { parseReceipt } from "@/lib/receipt";

type Opt = { id: string; name: string; bucketLabel?: string };
type Type = "EXPENSE" | "INCOME" | "TRANSFER";
const TYPES: { v: Type; l: string }[] = [{ v: "EXPENSE", l: "Uscita" }, { v: "INCOME", l: "Entrata" }, { v: "TRANSFER", l: "Trasferimento" }];

export interface TxInitial {
  id: string; type: Type; amount: string; date: string; accountId: string; toAccountId: string; categoryId: string; note: string; hasReceipt: boolean;
}

export function TransactionForm({ action, accounts, categories, today, initial, backHref }: {
  action: (f: FormData) => Promise<void>; accounts: Opt[]; categories: Opt[]; today: string; initial?: TxInitial; backHref: string;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [type, setType] = useState<Type>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? "");
  const [dropReceipt, setDropReceipt] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "warn" | "err"; msg?: string; pct?: number }>({ kind: "idle" });
  const [rawText, setRawText] = useState("");
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const clearScan = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setRawText(""); setStatus({ kind: "idle" });
    if (fileInput.current) fileInput.current.value = "";
  };

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setStatus({ kind: "busy", msg: "Preparo la scansione…", pct: 0 });
      const { blob, canvas } = await scanImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      // allega il JPEG scansionato al form
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "scontrino.jpg", { type: "image/jpeg" }));
      if (fileInput.current) fileInput.current.files = dt.files;

      setStatus({ kind: "busy", msg: "Leggo lo scontrino…", pct: 0 });
      const text = await recognize(canvas, (p) => setStatus({ kind: "busy", msg: "Leggo lo scontrino…", pct: Math.round(p * 100) }));
      setRawText(text);
      const r = parseReceipt(text);
      setType("EXPENSE");
      if (r.amount) setAmount((r.amount / 100).toFixed(2).replace(".", ","));
      if (r.date) setDate(r.date);
      if (r.merchant) setNote(r.merchant);
      const cat = r.categoryHint && categories.find((c) => c.name === r.categoryHint);
      if (cat) setCategoryId(cat.id);
      const found = [r.amount && "importo", r.date && "data", r.merchant && "negozio", cat && "categoria"].filter(Boolean);
      setStatus(found.length
        ? { kind: "ok", msg: `Letto: ${found.join(", ")}. Controlla i dati prima di salvare.` }
        : { kind: "warn", msg: "Scontrino archiviato ma non sono riuscito a leggere i dati: compilali a mano." });
    } catch (err) {
      setStatus({ kind: "err", msg: "Impossibile elaborare l'immagine. Puoi comunque inserire il movimento a mano." });
    }
  }

  async function submit(fd: FormData) {
    setPending(true);
    try {
      await action(fd);
      if (editing) { router.replace(backHref); router.refresh(); return; }
      setAmount(""); setNote(""); setCategoryId(""); setToAccountId("");
      clearScan();
    } finally { setPending(false); }
  }

  const busy = status.kind === "busy";
  return (
    <form action={submit} className={`card space-y-4 ${editing ? "ring-2 ring-amber-300" : ""}`}>
      {editing && (
        <div className="flex items-center justify-between">
          <h2 className="h2">Modifica movimento</h2>
          <Link href={backHref} className="btn-ghost">Annulla</Link>
        </div>
      )}
      {editing && <input type="hidden" name="id" value={initial!.id} />}
      {dropReceipt && <input type="hidden" name="dropReceipt" value="1" />}
      <input ref={fileInput} type="file" name="receipt" accept="image/*" className="hidden" tabIndex={-1} />
      <input type="hidden" name="type" value={type} />

      <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {TYPES.map((t) => (
          <button type="button" key={t.v} onClick={() => setType(t.v)}
            className={`flex-1 rounded-lg px-2 py-2 transition ${type === t.v ? (t.v === "INCOME" ? "bg-emerald-500 text-white shadow" : t.v === "EXPENSE" ? "bg-rose-500 text-white shadow" : "bg-indigo-500 text-white shadow") : "text-slate-500"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {type !== "INCOME" && (
        <div className="flex flex-wrap items-center gap-2">
          <ScanPicker label="Scatta scontrino" icon={<Camera size={18} />} capture onPick={onPick} disabled={busy} primary />
          <ScanPicker label="Da galleria" icon={<ImageIcon size={18} />} onPick={onPick} disabled={busy} />
          <span className="hidden text-xs text-slate-400 sm:inline">La lettura avviene sul tuo dispositivo.</span>
        </div>
      )}

      {editing && initial!.hasReceipt && !preview && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="flex items-center gap-2 text-slate-600"><Paperclip size={16} />{dropReceipt ? "Lo scontrino verrà rimosso" : "Scontrino archiviato"}</span>
          <span className="flex gap-2">
            {!dropReceipt && <a href={`/api/receipts/${initial!.id}`} target="_blank" rel="noreferrer" className="btn-ghost">Vedi</a>}
            <button type="button" className="btn-ghost" onClick={() => setDropReceipt(!dropReceipt)}>{dropReceipt ? "Annulla" : "Rimuovi"}</button>
          </span>
        </div>
      )}

      {status.kind !== "idle" && (
        <div className={`flex items-start gap-3 rounded-xl p-3 text-sm ${status.kind === "err" ? "bg-rose-50 text-rose-700" : status.kind === "warn" ? "bg-amber-50 text-amber-800" : status.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}>
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Scansione scontrino" className="h-20 w-14 shrink-0 rounded-lg border border-slate-200 object-cover object-top" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-medium">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}{status.msg}{busy && status.pct ? ` ${status.pct}%` : ""}
            </div>
            {busy && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${status.pct ?? 5}%` }} /></div>}
            {rawText && !busy && <details className="mt-1 text-xs opacity-80"><summary className="cursor-pointer">Testo letto</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{rawText}</pre></details>}
          </div>
          {!busy && <button type="button" onClick={clearScan} className="rounded-lg p-1 hover:bg-black/5" aria-label="Rimuovi scansione"><X size={16} /></button>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2"><label className="label">Importo (€)</label>
          <input name="amount" required inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="input !text-xl font-semibold" /></div>
        <div className="sm:col-span-2"><label className="label">Data</label><input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">{type === "TRANSFER" ? "Da conto" : "Conto"}</label>
          <select name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        {type === "TRANSFER" ? (
          <div className="sm:col-span-3"><label className="label">Verso conto</label>
            <select name="toAccountId" required value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="input"><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        ) : (
          <div className="sm:col-span-3"><label className="label">Categoria</label>
            <select name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.bucketLabel ? ` (${c.bucketLabel})` : ""}</option>)}</select></div>
        )}
        <div className={type === "TRANSFER" ? "sm:col-span-3" : "sm:col-span-3"}><label className="label">Nota / negozio</label>
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" /></div>
      </div>
      <button className="btn w-full py-3 text-base sm:w-auto" disabled={pending || busy}>{pending ? "Salvo…" : editing ? "Salva modifiche" : "Aggiungi movimento"}</button>
    </form>
  );
}

function ScanPicker({ label, icon, onPick, capture, disabled, primary }: { label: string; icon: React.ReactNode; onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; capture?: boolean; disabled?: boolean; primary?: boolean }) {
  return (
    <label className={`${primary ? "btn" : "btn-outline"} cursor-pointer gap-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {icon}{label}
      <input type="file" accept="image/*" {...(capture ? { capture: "environment" } : {})} className="hidden" onChange={onPick} />
    </label>
  );
}
