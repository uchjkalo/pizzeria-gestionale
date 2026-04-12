"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToActiveOrders, updateOrderStatus } from "@/lib/orders";
import { Order } from "@/types";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const minutesSince = (date: Date) =>
  Math.floor((Date.now() - date.getTime()) / 60000);

const orderTypeLabel = (order: Order) => {
  if (order.type === "tavolo")  return `🪑 Tavolo ${order.tableNumber}`;
  if (order.type === "asporto") return `🥡 ${order.customerName || "Asporto"}`;
  return `🚴 ${order.customerName || "Delivery"}`;
};

export default function RifinituraZone() {
  const { loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow]       = useState(new Date());

  useEffect(() => {
    return subscribeToActiveOrders((all) => {
      // Rifinitura vede solo ordini PRONTI
      setOrders(all.filter(o => o.status === "pronto"));
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-4 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white text-2xl font-bold">📦 Rifinitura</h1>
        <div className="flex items-center gap-3">
          {orders.length > 0 && (
            <span className="bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              {orders.length} pronti da consegnare
            </span>
          )}
          <span className="text-gray-500 text-sm">{formatTime(now)}</span>
        </div>
      </div>

      {/* Lista ordini pronti */}
      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <p className="text-6xl mb-4">✅</p>
          <p className="text-xl font-medium">Nessun ordine pronto</p>
          <p className="text-sm mt-2">Gli ordini pronti appariranno qui automaticamente</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start pr-1">
          {orders.map(order => {
            const minutes = minutesSince(order.updatedAt);
            const hasExtras = order.extras && order.extras.length > 0;
            const hasModified = order.items.some(
              i => i.removedIngredients.length > 0 || i.addedIngredients.length > 0 || i.notes
            );

            return (
              <div key={order.id}
                className={`bg-gray-800 rounded-2xl border-2 p-4 flex flex-col gap-3 ${
                  minutes >= 5 ? "border-red-500" : "border-green-500"
                }`}>

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white text-lg font-bold">{orderTypeLabel(order)}</p>
                    {order.type === "tavolo" && order.peopleCount && (
                      <p className="text-gray-400 text-xs">{order.peopleCount} persone</p>
                    )}
                    {order.type === "delivery" && order.deliveryAddress && (
                      <p className="text-blue-300 text-xs">📍 {order.deliveryAddress}</p>
                    )}
                    {order.desiredTime && (
                      <p className="text-blue-300 text-xs">🕐 Entro le {order.desiredTime}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      ✅ PRONTO
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      minutes >= 5 ? "text-red-400" : "text-gray-400"
                    }`}>
                      da {minutes}min
                    </span>
                  </div>
                </div>

                {/* ⚠️ ALERT MODIFICHE — evidenziate in grande */}
                {hasModified && (
                  <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-3 space-y-2">
                    <p className="text-red-400 font-bold text-xs uppercase tracking-wide">⚠️ Attenzione — modifiche:</p>
                    {order.items.filter(i => i.removedIngredients.length > 0 || i.addedIngredients.length > 0 || i.notes).map(item => (
                      <div key={item.cartId} className="space-y-0.5">
                        <p className="text-white text-sm font-semibold">
                          {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                          {item.name}
                          {item.size !== "normale" && <span className="text-yellow-400"> [{item.size}]</span>}
                        </p>
                        {item.removedIngredients.length > 0 && (
                          <p className="text-red-400 text-xs font-bold">🚫 SENZA: {item.removedIngredients.join(", ")}</p>
                        )}
                        {item.addedIngredients.length > 0 && (
                          <p className="text-green-400 text-xs font-bold">➕ CON: {item.addedIngredients.map(x => x.name).join(", ")}</p>
                        )}
                        {item.notes && (
                          <p className="text-yellow-300 text-xs">📝 {item.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ⚠️ ALERT EXTRA */}
                {hasExtras && (
                  <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-3">
                    <p className="text-blue-400 font-bold text-xs uppercase tracking-wide mb-1">➕ Extra da aggiungere:</p>
                    {order.extras.map((e, i) => (
                      <p key={i} className="text-blue-200 text-sm font-semibold">• {e.description} — €{e.price.toFixed(2)}</p>
                    ))}
                  </div>
                )}

                {/* Elenco completo prodotti */}
                <div className="space-y-1">
                  <p className="text-gray-400 text-xs font-semibold uppercase">Prodotti:</p>
                  {order.items.map(item => (
                    <div key={item.cartId} className="flex items-center gap-2">
                      <span className="text-white text-sm">
                        {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                        {item.name}
                      </span>
                      {item.size !== "normale" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                          item.size === "maxi" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                        }`}>{item.size.toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Note ordine */}
                {order.orderNotes && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5">
                    <p className="text-yellow-300 text-xs">📋 {order.orderNotes}</p>
                  </div>
                )}

                {/* Totale */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">Totale ordine</span>
                  <span className="text-orange-400 text-lg font-bold">€{order.total.toFixed(2)}</span>
                </div>

                {/* Azioni */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateOrderStatus(order.id, "consegnato")}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                    🚀 Consegnato
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, "preparazione")}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 px-3 rounded-xl transition-colors">
                    ↩ Indietro
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}