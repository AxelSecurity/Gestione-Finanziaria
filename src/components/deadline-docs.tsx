import { Paperclip, FileText, Image as ImageIcon, FileSpreadsheet, Trash2 } from "lucide-react";
import { addDeadlineDocuments, deleteDeadlineDocument } from "@/server/actions";
import { ACCEPT } from "@/server/documents";
import { StateForm } from "@/components/form-state";
import { DocScanner } from "@/components/doc-scanner";

type Doc = { id: string; name: string; ext: string; size: number };

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const Icon = ({ ext }: { ext: string }) =>
  ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? <ImageIcon size={16} /> : ["xls", "xlsx", "ods", "csv"].includes(ext) ? <FileSpreadsheet size={16} /> : <FileText size={16} />;

/** Pannello allegati di una scadenza: elenco + caricamento. `readonly` per le scadenze già pagate (solo consultazione ed eliminazione). */
export function DeadlineDocs({ deadlineId, docs }: { deadlineId: string; docs: Doc[] }) {
  return (
    <details className="basis-full">
      <summary className="btn-ghost cursor-pointer gap-1.5"><Paperclip size={14} /> Documenti{docs.length > 0 && <span className="pill bg-emerald-50 text-emerald-700">{docs.length}</span>}</summary>
      <div className="mt-2 space-y-3 rounded-xl bg-slate-50 p-3">
        {docs.length > 0 && (
          <ul className="divide-y divide-slate-200 text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <span className="text-slate-400"><Icon ext={d.ext} /></span>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-emerald-700 hover:underline">{d.name}</a>
                <span className="shrink-0 text-xs text-slate-400">{size(d.size)}</span>
                <form action={deleteDeadlineDocument.bind(null, d.id)}><button className="btn-ghost" aria-label="Elimina documento"><Trash2 size={15} /></button></form>
              </li>
            ))}
          </ul>
        )}
        <StateForm action={addDeadlineDocuments} submit="Carica" className="flex flex-wrap items-end gap-2" resetOnOk>
          <input type="hidden" name="deadlineId" value={deadlineId} />
          <div className="min-w-0 flex-1 basis-60">
            <label className="label">Aggiungi documenti (F24, bollettini, polizze…)</label>
            <input name="documents" type="file" multiple accept={`${ACCEPT},image/*`} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-emerald-700" />
          </div>
          <DocScanner autoSubmit />
        </StateForm>
      </div>
    </details>
  );
}
