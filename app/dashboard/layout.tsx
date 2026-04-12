"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

const zones = [
  { name: "Ordini",       path: "/dashboard/ordini",       emoji: "🧾" },
  { name: "Cucina",       path: "/dashboard/cucina",       emoji: "🍳" },
  { name: "Fritture",     path: "/dashboard/fritture",     emoji: "🍟" },
  { name: "Preparazione", path: "/dashboard/preparazione", emoji: "🍕" },
  { name: "Rifinitura",   path: "/dashboard/rifinitura",   emoji: "📦" },
  { name: "Cassa",        path: "/dashboard/cassa",        emoji: "💳" },
  { name: "Statistiche",  path: "/dashboard/statistiche",  emoji: "📊" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">

      {/* NAVBAR */}
      <nav className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-orange-400 font-bold text-lg mr-2">🍕 Pizzeria</span>

        {zones.map((zone) => (
          <Link
            key={zone.path}
            href={zone.path}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === zone.path
                ? "bg-orange-500 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            {zone.emoji} {zone.name}
          </Link>
        ))}

        {/* Logout in fondo */}
        <button
          onClick={handleLogout}
          className="ml-auto text-gray-400 hover:text-red-400 text-sm transition-colors"
        >
          Esci →
        </button>
      </nav>

      {/* CONTENUTO ZONA */}
      <main className="flex-1 p-6">
        {children}
      </main>

    </div>
  );
}