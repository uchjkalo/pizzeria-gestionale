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
  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [showFelice, setShowFelice] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    return subscribeToPaidToday((raw) => {
      setOrders(raw as PaidOrder[]);
    });
  }, []);

  const handleResetStats = async () => {
    const confirmed = window.confirm(
      "Azzerare completamente le statistiche di oggi? Questa azione elimina lo storico pagato odierno."
    );
    if (!confirmed) return;

    try {
      setIsResetting(true);
      const removed = await resetPaidTodayStats();
      window.alert(`Statistiche azzerate. Ordini rimossi: ${removed}`);
    } catch {
      window.alert("Errore durante l'azzeramento delle statistiche.");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  // ── Calcoli statistiche ──
  const totaleGiornata  = orders.reduce((s, o) => s + o.total, 0);
  const totaleContanti  = orders.filter(o => o.paymentMethod === "contanti").reduce((s, o) => s + o.total, 0);
  const totaleCarta     = orders.filter(o => o.paymentMethod === "carta").reduce((s, o) => s + o.total, 0);
  const totaleFelice    = orders.filter(o => o.felice).reduce((s, o) => s + o.total, 0);
  const totaleNonFelice = orders.filter(o => !o.felice).reduce((s, o) => s + o.total, 0);
  const ordiniTavolo    = orders.filter(o => o.type === "tavolo").length;
  const ordiniAsporto   = orders.filter(o => o.type === "asporto").length;
  const ordiniDelivery  = orders.filter(o => o.type === "delivery").length;
  const ticketMedio     = orders.length > 0 ? totaleGiornata / orders.length : 0;

  // Prodotti più venduti
  const productCount: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!productCount[item.id]) {
        productCount[item.id] = { name: item.name, qty: 0, revenue: 0 };
      }
      productCount[item.id].qty     += item.quantity;
      productCount[item.id].revenue += item.effectivePrice * item.quantity;
    });
  });
  const topProducts = Object.values(productCount)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Ordini per ora
  const byHour: Record<number, number> = {};
  orders.forEach(o => {
    const h = o.paidAt.getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  });
  const maxByHour = Math.max(...Object.values(byHour), 1);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto space-y-6 pr-1">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">📊 Statistiche</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            {" — "}{orders.length} ordini completati
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetStats}
            disabled={isResetting || orders.length === 0}
            className="bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            title="Azzera completamente lo storico pagato di oggi">
            {isResetting ? "Azzeramento..." : "🗑️ Azzera statistiche"}
          </button>
          {/* Bottone segreto felice */}
          <button
            onClick={() => setShowFelice(s => !s)}
            className="text-gray-700 hover:text-gray-500 text-xs transition-colors select-none"
            title="">
            ●
          </button>
        </div>
      </div>

      {/* ── CARD PRINCIPALI ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Incasso totale</p>
          <p className="text-orange-400 text-4xl font-black mt-1">€{totaleGiornata.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{orders.length} ordini</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Ticket medio</p>
          <p className="text-blue-400 text-4xl font-black mt-1">€{ticketMedio.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">per ordine</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide">💵 Contanti</p>
          <p className="text-green-400 text-4xl font-black mt-1">€{totaleContanti.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{orders.filter(o => o.paymentMethod === "contanti").length} ordini</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide">💳 Carta</p>
          <p className="text-purple-400 text-4xl font-black mt-1">€{totaleCarta.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{orders.filter(o => o.paymentMethod === "carta").length} ordini</p>
        </div>
      </div>

      {/* ── PANNELLO FELICE (nascosto) ── */}
      {showFelice && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 space-y-3">
          <h2 className="text-gray-300 font-bold text-sm">😊 Dettaglio felicità</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
              <p className="text-yellow-300 text-xs mb-1">😊 Felice</p>
              <p className="text-yellow-400 text-3xl font-black">€{totaleFelice.toFixed(2)}</p>
              <p className="text-gray-500 text-xs mt-1">{orders.filter(o => o.felice).length} ordini</p>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-3 text-center">
              <p className="text-gray-300 text-xs mb-1">😐 Non felice</p>
              <p className="text-gray-300 text-3xl font-black">€{totaleNonFelice.toFixed(2)}</p>
              <p className="text-gray-500 text-xs mt-1">{orders.filter(o => !o.felice).length} ordini</p>
            </div>
          </div>
          {/* Storico ordini con dettaglio felice */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {orders.map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-700/50">
                <span className="text-gray-400">{formatTime(o.paidAt)} — {o.type}</span>
                <span className="text-gray-300">€{o.total.toFixed(2)}</span>
                <span>{o.felice ? "😊" : "😐"}</span>
                <span className={o.paymentMethod === "contanti" ? "text-green-400" : "text-purple-400"}>
                  {o.paymentMethod === "contanti" ? "💵" : "💳"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TIPO ORDINI ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "🪑 Tavolo",  value: ordiniTavolo,   color: "text-orange-400" },
          { label: "🥡 Asporto", value: ordiniAsporto,  color: "text-blue-400"   },
          { label: "🚴 Delivery", value: ordiniDelivery, color: "text-green-400"  },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-center">
            <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
            <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-xs mt-1">ordini</p>
          </div>
        ))}
      </div>

      {/* ── PRODOTTI PIÙ VENDUTI ── */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
        <h2 className="text-white font-bold mb-4">🏆 Prodotti più venduti oggi</h2>
        {topProducts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nessun dato ancora</p>
        ) : (
          <div className="space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className={`text-sm font-black w-6 shrink-0 ${
                  i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-700" : "text-gray-600"
                }`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-sm font-medium truncate">{p.name}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-orange-400 text-xs font-bold">×{p.qty}</span>
                      <span className="text-gray-400 text-xs">€{p.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* Barra progressiva */}
                  <div className="h-1.5 bg-gray-700 rounded-full">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DISTRIBUZIONE ORARIA ── */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
        <h2 className="text-white font-bold mb-4">🕐 Ordini per ora</h2>
        {Object.keys(byHour).length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nessun dato ancora</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {Array.from({ length: 24 }, (_, h) => {
              const count = byHour[h] ?? 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-gray-400 text-xs">{count > 0 ? count : ""}</span>
                  <div
                    className={`w-full rounded-t transition-all ${count > 0 ? "bg-orange-500" : "bg-gray-700"}`}
                    style={{ height: `${(count / maxByHour) * 100}%`, minHeight: count > 0 ? "4px" : "2px" }}
                  />
                  <span className="text-gray-600 text-xs">{h}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── STORICO ORDINI GIORNATA ── */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
        <h2 className="text-white font-bold mb-4">📋 Storico ordini di oggi</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nessun ordine completato oggi</p>
        ) : (
          <div className="space-y-2">
            {orders.map(order => (
              <div key={order.id}
                className="flex items-center gap-3 py-2 border-b border-gray-700/50 last:border-0">
                <span className="text-gray-500 text-xs w-10 shrink-0">{formatTime(order.paidAt)}</span>
                <span className="text-gray-300 text-sm flex-1 truncate">
                  {order.type === "tavolo"
                    ? `🪑 T${order.tableNumber}`
                    : order.type === "asporto"
                    ? `🥡 ${order.customerName || "Asporto"}`
                    : `🚴 ${order.customerName || "Delivery"}`}
                </span>
                <span className="text-gray-400 text-xs">{order.items.length} prod.</span>
                {/* Felice — sempre visibile nello storico */}
                <span title={order.felice ? "Con scontrino" : "Senza scontrino"}>
                  {order.felice ? "😊" : "😐"}
                </span>
                <span className={order.paymentMethod === "contanti" ? "text-green-400" : "text-purple-400"}>
                  {order.paymentMethod === "contanti" ? "💵" : "💳"}
                </span>
                <span className="text-orange-400 text-sm font-bold shrink-0">€{order.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}