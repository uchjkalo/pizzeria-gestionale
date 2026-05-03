"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToPaidToday, resetPaidTodayStats } from "@/lib/orders";
import { Order } from "@/types";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

interface PaidOrder extends Order {
  paidAt: Date;
  paymentMethod: "contanti" | "carta";
  felice: boolean;
}

export default function StatisticheZone() {
  const { loading } = useAuth();
  const [orders, setOrders]       = useState<PaidOrder[]>([]);
  const [showFelice, setShowFelice] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    return subscribeToPaidToday(raw => setOrders(raw as PaidOrder[]));
  }, []);

  const handleResetStats = async () => {
    if (!window.confirm("Azzerare le statistiche di oggi?")) return;
    try {
      setIsResetting(true);
      const removed = await resetPaidTodayStats();
      window.alert(`Statistiche azzerate. Ordini rimossi: ${removed}`);
    } catch { window.alert("Errore durante l'azzeramento."); }
    finally { setIsResetting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const totaleGiornata  = orders.reduce((s, o) => s + o.total, 0);
  const totaleContanti  = orders.filter(o => o.paymentMethod === "contanti").reduce((s, o) => s + o.total, 0);
  const totaleCarta     = orders.filter(o => o.paymentMethod === "carta").reduce((s, o) => s + o.total, 0);
  const totaleFelice    = orders.filter(o => o.felice).reduce((s, o) => s + o.total, 0);
  const totaleNonFelice = orders.filter(o => !o.felice).reduce((s, o) => s + o.total, 0);
  const ordiniTavolo    = orders.filter(o => o.type === "tavolo").length;
  const ordiniAsporto   = orders.filter(o => o.type === "asporto").length;
  const ordiniDelivery  = orders.filter(o => o.type === "delivery").length;
  const ticketMedio     = orders.length > 0 ? totaleGiornata / orders.length : 0;

  const productCount: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!productCount[item.id]) productCount[item.id] = { name: item.name, qty: 0, revenue: 0 };
      productCount[item.id].qty     += item.quantity;
      productCount[item.id].revenue += item.effectivePrice * item.quantity;
    });
  });
  const topProducts = Object.values(productCount).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Ordini per ora — solo dalle 8 alle 23
  const byHour: Record<number, number> = {};
  orders.forEach(o => {
    const h = o.paidAt.getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  });
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 8 → 23
  const maxByHour = Math.max(...HOURS.map(h => byHour[h] ?? 0), 1);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto space-y-5 pr-0.5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-white text-2xl font-bold">📊 Statistiche</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            {" — "}{orders.length} ordini
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetStats} disabled={isResetting || orders.length === 0}
            className="bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
            {isResetting ? "Azzeramento..." : "🗑️ Azzera"}
          </button>
          {/* Bottone segreto felice */}
          <button onClick={() => setShowFelice(s => !s)}
            className="text-gray-800 hover:text-gray-600 text-xs select-none px-1">●</button>
        </div>
      </div>

      {/* Card principali */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Incasso totale", value: `€${totaleGiornata.toFixed(2)}`, sub: `${orders.length} ordini`, color: "text-orange-400" },
          { label: "Ticket medio",   value: `€${ticketMedio.toFixed(2)}`,    sub: "per ordine",              color: "text-blue-400"   },
          { label: "💵 Contanti",    value: `€${totaleContanti.toFixed(2)}`, sub: `${orders.filter(o => o.paymentMethod === "contanti").length} ordini`, color: "text-green-400" },
          { label: "💳 Carta",       value: `€${totaleCarta.toFixed(2)}`,    sub: `${orders.filter(o => o.paymentMethod === "carta").length} ordini`,    color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700/50">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest">{s.label}</p>
            <p className={`${s.color} text-3xl font-black mt-1 tabular-nums`}>{s.value}</p>
            <p className="text-gray-600 text-xs mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Pannello felice — nascosto */}
      {showFelice && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700/50 p-4 space-y-3">
          <h2 className="text-gray-400 font-bold text-sm">😊 Dettaglio</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
              <p className="text-yellow-300 text-xs mb-1">😊</p>
              <p className="text-yellow-400 text-2xl font-black tabular-nums">€{totaleFelice.toFixed(2)}</p>
              <p className="text-gray-600 text-xs mt-1">{orders.filter(o => o.felice).length} ordini</p>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">😐</p>
              <p className="text-gray-300 text-2xl font-black tabular-nums">€{totaleNonFelice.toFixed(2)}</p>
              <p className="text-gray-600 text-xs mt-1">{orders.filter(o => !o.felice).length} ordini</p>
            </div>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {orders.map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-700/40">
                <span className="text-gray-500">{formatTime(o.paidAt)} — {o.type}</span>
                <span className="text-gray-300 tabular-nums">€{o.total.toFixed(2)}</span>
                <span>{o.felice ? "😊" : "😐"}</span>
                <span className={o.paymentMethod === "contanti" ? "text-green-400" : "text-purple-400"}>
                  {o.paymentMethod === "contanti" ? "💵" : "💳"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipo ordini */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "🪑 Tavolo",   value: ordiniTavolo,   color: "text-orange-400" },
          { label: "🥡 Asporto",  value: ordiniAsporto,  color: "text-blue-400"   },
          { label: "🚴 Delivery", value: ordiniDelivery, color: "text-green-400"  },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700/50 text-center">
            <p className="text-gray-500 text-xs mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Top prodotti */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700/50 p-4">
        <h2 className="text-white font-bold mb-4">🏆 Prodotti più venduti</h2>
        {topProducts.length === 0
          ? <p className="text-gray-600 text-sm text-center py-4">Nessun dato</p>
          : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`text-sm font-black w-6 shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-700" : "text-gray-600"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm font-medium truncate">{p.name}</span>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-orange-400 text-xs font-bold">×{p.qty}</span>
                        <span className="text-gray-500 text-xs tabular-nums">€{p.revenue.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Ordini per ora — solo 8-23 */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700/50 p-4">
        <h2 className="text-white font-bold mb-4">🕐 Ordini per ora</h2>
        {Object.keys(byHour).length === 0
          ? <p className="text-gray-600 text-sm text-center py-4">Nessun dato</p>
          : (
            <div className="flex items-end gap-1 h-28">
              {HOURS.map(h => {
                const count = byHour[h] ?? 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-gray-500 text-[9px] tabular-nums">{count > 0 ? count : ""}</span>
                    <div className={`w-full rounded-t transition-all ${count > 0 ? "bg-orange-500" : "bg-gray-700"}`}
                      style={{ height: `${(count / maxByHour) * 100}%`, minHeight: count > 0 ? "4px" : "2px" }} />
                    <span className="text-gray-600 text-[9px] tabular-nums">{h}</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Storico */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700/50 p-4">
        <h2 className="text-white font-bold mb-4">📋 Storico oggi</h2>
        {orders.length === 0
          ? <p className="text-gray-600 text-sm text-center py-4">Nessun ordine completato</p>
          : (
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className="flex items-center gap-3 py-2 border-b border-gray-700/40 last:border-0">
                  <span className="text-gray-600 text-xs w-10 shrink-0 tabular-nums">{formatTime(order.paidAt)}</span>
                  <span className="text-gray-300 text-sm flex-1 truncate">
                    {order.type === "tavolo" ? `🪑 T${order.tableNumber}` : order.type === "asporto" ? `🥡 ${order.customerName || "Asporto"}` : `🚴 ${order.customerName || "Delivery"}`}
                  </span>
                  <span className="text-gray-500 text-xs">{order.items.length} prod.</span>
                  <span title={order.felice ? "Sì" : "No"}>{order.felice ? "😊" : "😐"}</span>
                  <span className={order.paymentMethod === "contanti" ? "text-green-400" : "text-purple-400"}>
                    {order.paymentMethod === "contanti" ? "💵" : "💳"}
                  </span>
                  <span className="text-orange-400 text-sm font-bold shrink-0 tabular-nums">€{order.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
      </div>

    </div>
  );
}
