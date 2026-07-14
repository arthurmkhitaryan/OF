import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  CandlestickChart,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Plus,
  ScrollText,
  Wallet,
} from "lucide-react";

const nav = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/live", label: "Live", icon: CandlestickChart },
  { href: "/gex", label: "GEX", icon: Activity },
  { href: "/accounts", label: "Аккаунты", icon: Wallet },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/trades", label: "Сделки", icon: BookOpen },
  { href: "/playbook", label: "Playbook", icon: ScrollText },
  { href: "/examples", label: "Examples", icon: Lightbulb },
  { href: "/statistics", label: "Статистика", icon: BarChart3 },
  { href: "/trades/new", label: "Новая сделка", icon: Plus },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
          Order Flow
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">Trading Journal</h1>
        <p className="mt-1 text-xs text-zinc-500">NQ · ES · Range & Trend</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
