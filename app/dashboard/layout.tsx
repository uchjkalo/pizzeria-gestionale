"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

const zones = [
  { name: "Ordini",       path: "/dashboard/ordini",       emoji: "🧾" },
  { name: "Cucina",       path: "/dashboard/cucina",       emoji: "🍳" },
  { name: "Fritture",     path: "/dashboard/fritture",     emoji: "🍟" },
  { name: "Preparaz.",    path: "/dashboard/preparazione", emoji: "🍕" },
  { name: "Rifinitura",   path: "/dashboard/rifinitura",   emoji: "📦" },
  { name: "Cassa",        path: "/dashboard/cassa",        emoji: "💳" },
  { name: "Statistiche",  path: "/dashboard/statistiche",  emoji: "📊" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => { await logout(); router.push("/"); };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">

      {/* ── DESKTOP: top navbar ── */}
      <nav className="hidden md:flex bg-gray-800 border-b border-gray-700 px-3 py-2 items-center gap-1 flex-wrap shrink-0">
        <span className="text-orange-400 font-bold text-base mr-2 shrink-0">🍕</span>
        {zones.map(z => (
          <Link key={z.path} href={z.path}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              pathname === z.path
                ? "bg-orange-500 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}>
            {z.emoji} {z.name}
          </Link>
        ))}
        <button onClick={handleLogout}
          className="ml-auto text-gray-400 hover:text-red-400 text-sm transition-colors shrink-0">
          Esci →
        </button>
      </nav>

      {/* ── CONTENUTO ── */}
      <main className="flex-1 overflow-auto md:overflow-hidden p-3 md:p-5 pb-24 md:pb-5">
        {children}
      </main>


      {/* ── MOBILE: bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-40">
        <div className="grid grid-cols-7 h-16">
          {zones.map(z => {
            const active = pathname === z.path;
            return (
              <Link key={z.path} href={z.path}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-orange-400" : "text-gray-500"
                }`}>
                <span className="text-2xl leading-none">{z.emoji}</span>
                <span className="text-[9px] font-medium leading-none truncate w-full text-center px-0.5">
                  {z.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
