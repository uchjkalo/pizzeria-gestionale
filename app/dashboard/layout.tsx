"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

const zones = [
  { name: "Ordini",       path: "/dashboard/ordini",       icon: "📋" },
  { name: "Cucina",       path: "/dashboard/cucina",       icon: "🍳" },
  { name: "Fritture",     path: "/dashboard/fritture",     icon: "🍟" },
  { name: "Preparaz.",    path: "/dashboard/preparazione", icon: "🍕" },
  { name: "Rifinitura",   path: "/dashboard/rifinitura",   icon: "📦" },
  { name: "Cassa",        path: "/dashboard/cassa",        icon: "💳" },
  { name: "Statistiche",  path: "/dashboard/statistiche",  icon: "📊" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const handleLogout = async () => { 
    await logout(); 
    router.push("/"); 
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ══════════════════════════════════════════════════════════
          DESKTOP NAVBAR - Top navigation for larger screens
          ══════════════════════════════════════════════════════════ */}
      <nav className="hidden md:flex bg-gray-200 border-b border-gray-300 px-4 py-3 items-center gap-2 shrink-0 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <span className="text-2xl">🍕</span>
          <span className="font-bold text-gray-900 text-sm hidden lg:inline">Al Cjanton</span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1 flex-wrap">
          {zones.map(zone => (
            <Link 
              key={zone.path} 
              href={zone.path}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                pathname === zone.path 
                  ? "bg-red-600 text-white shadow-md" 
                  : "text-gray-700 hover:bg-gray-300 hover:text-gray-900"
              }`}
            >
              <span className="inline mr-1">{zone.icon}</span>
              {zone.name}
            </Link>
          ))}
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="ml-auto text-gray-600 hover:text-red-600 text-sm font-medium transition-colors shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-100"
        >
          <span>→</span>
          <span className="hidden sm:inline">Esci</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-auto md:overflow-hidden p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════
          MOBILE BOTTOM TAB BAR - Fixed navigation for mobile/tablet
          ══════════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-200 border-t border-gray-300 z-40 shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-7 gap-1 p-2">
          {zones.map(zone => {
            const active = pathname === zone.path;
            return (
              <Link 
                key={zone.path} 
                href={zone.path}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all ${
                  active 
                    ? "text-red-600 bg-red-900/20" 
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <span className="text-xl leading-none">{zone.icon}</span>
                <span className="text-[10px] font-semibold leading-none truncate w-full text-center">
                  {zone.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
