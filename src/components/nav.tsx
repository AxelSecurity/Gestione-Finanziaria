"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, ArrowLeftRight, PiggyBank, CalendarClock, TrendingUp, BarChart3, Settings } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Movimenti", icon: ArrowLeftRight },
  { href: "/budget", label: "50/30/20", icon: PiggyBank },
  { href: "/deadlines", label: "Scadenze", icon: CalendarClock },
  { href: "/investments", label: "Patrimonio", icon: TrendingUp },
  { href: "/reports", label: "Report", icon: BarChart3 },
  { href: "/settings", label: "Impost.", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function SideNav({ isAdmin }: { isAdmin?: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...NAV, { href: "/users", label: "Utenti", icon: Users }] : NAV;
  return (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon size={18} /> {label === "Impost." ? "Impostazioni" : label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-2 z-20 flex justify-around rounded-2xl border border-white/60 bg-white/90 py-1.5 shadow-xl shadow-slate-900/10 backdrop-blur md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} className={`flex flex-col items-center rounded-xl px-1.5 py-1 text-[9px] font-medium ${on ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}>
            <Icon size={18} />{label}
          </Link>
        );
      })}
    </nav>
  );
}
