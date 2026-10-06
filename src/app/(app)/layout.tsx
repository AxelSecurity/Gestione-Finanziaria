import Link from "next/link";
import { Wallet, LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions";
import { requireUser } from "@/lib/session";
import { BottomNav, SideNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const label = user.name || user.email;
  const initial = label.charAt(0).toUpperCase();
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/70 bg-white/70 p-4 backdrop-blur md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 pt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/30"><Wallet size={18} /></span>
          <div className="leading-tight"><div className="font-bold text-slate-900">Finanza</div><div className="text-[11px] text-slate-400">Personale · 50/30/20</div></div>
        </div>
        <SideNav isAdmin={user.isAdmin} />
        <div className="mt-auto space-y-1 border-t border-slate-100 pt-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 text-sm font-bold text-white">{initial}</span>
            <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium text-slate-800">{label}</span><span className="block text-[11px] text-slate-400">{user.isAdmin ? "Amministratore" : "Utente"}</span></span>
          </Link>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"><LogOut size={18} /> Esci</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/70 bg-white/80 px-4 py-2 backdrop-blur md:hidden" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white"><Wallet size={16} /></span>Finanza</div>
        <Link href="/profile" aria-label="Profilo" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 text-sm font-bold text-white">{initial}</Link>
      </header>

      <BottomNav />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 pb-28 md:p-8">{children}</main>
    </div>
  );
}
