"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, updateOrderStatus } from "@/lib/orders";
import { createKitchenTask } from "@/lib/kitchen";
import { Order, OrderItem } from "@/types";
import { menu } from "@/lib/menu";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const minutesSince = (date: Date) =>
  Math.floor((Date.now() - date.getTime()) / 60000);

const orderLabel = (o: Order) =>
  o.type === "tavolo"
    ? `🪑 Tavolo ${o.tableNumber} (${o.peopleCount} pers.)`
    : o.type === "asporto"
    ? `🥡 ${o.customerName || "Asporto"}`
    : `🚴 ${o.customerName || o.deliveryAddress || "Delivery"}`;

// Ingredienti che si aggiungono DOPO la cottura
const POST_COOKING = new Set([
  "prosciutto crudo san daniele", "prosciutto san daniele", "prosciutto crudo",
  "rucola", "grana padano", "pomodorini", "bufala", "mozzarella di bufala",
  "burrata", "granella di pistacchio", "semi di papavero", "pesto",
  "pomodori secchi", "olio al tartufo", "maionese", "prezzemolo",
  "mortadella", "panna", "kren",
]);
const isPostCooking = (ing: string) => POST_COOKING.has(ing.toLowerCase().trim());

interface CheckItem { key: string; label: string; type: "remove" | "add" | "note" | "finish" }

const buildChecklist = (item: OrderItem): CheckItem[] => {
  const menuItem = menu.find(m => m.id === item.id);
  const list: CheckItem[] = [];
  item.removedIngredients.forEach(ing =>
    list.push({ key: `r_${ing}`, label: `Verificare assenza: ${ing}`, type: "remove" })
  );
  item.addedIngredients.forEach(ing =>
    list.push({ key: `a_${ing.name}`, label: `Aggiungere: ${ing.name}`, type: "add" })
  );
  if (item.notes)
    list.push({ key: "note", label: `Nota: ${item.notes}`, type: "note" });
  if (menuItem) {
    menuItem.ingredients
      .filter(ing => !item.removedIngredients.includes(ing) && isPostCooking(ing))
      .forEach(ing =>
        list.push({ key: `f_${ing}`, label: `Ingrediente post-cottura: ${ing}`, type: "finish" })
      );
  }
  return list;
};

const checkColor: Record<CheckItem["type"], string> = {
  remove: "text-red-400",
  add:    "text-green-400",
  note:   "text-yellow-300",
  finish: "text-blue-300",
};
const checkIcon: Record<CheckItem["type"], string> = {
  remove: "🚫", add: "➕", note: "📝", finish: "🍕",
};

export default function PreparazioneZone() {
  const { loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow]       = useState(new Date());
  // Stato locale checklist: orderId -> set di chiavi spuntate
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});
  // Conclusi espansi
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const prevPronto = useRef(0);
  useEffect(() => {
    return subscribeToOrdersToday(all => {
      const pronti = all.filter(o => o.status === "pronto").length;
      if (pronti > prevPronto.current) playBeep();
      prevPronto.current = pronti;
      setOrders(all);
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const toggleCheck = (orderId: string, key: string) => {
    setChecked(prev => {
      const s = new Set(prev[orderId] ?? []);
      s.has(key) ? s.delete(key) : s.add(key);
      return { ...prev, [orderId]: s };
    });
  };
  const isChecked = (orderId: string, key: string) =>
    checked[orderId]?.has(key) ?? false;

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const sendToKitchen = async (order: Order, zone: "cucina" | "fritture") => {
    const cats = zone === "cucina" ? ["pizze","panini","burger","specialita"] : ["fritti"];
    for (const item of order.items.filter(i => cats.includes(i.category))) {
      const sz  = item.size !== "normale" ? ` [${item.size.toUpperCase()}]` : "";
      const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
      await createKitchenTask({ orderId: order.id, description: `${item.name}${sz}${qty}`, zone, completed: false });
      if (item.removedIngredients.length > 0)
        await createKitchenTask({ orderId: order.id, description: `  ✗ SENZA: ${item.removedIngredients.join(", ")}`, zone, completed: false });
      if (item.addedIngredients.length > 0)
        await createKitchenTask({ orderId: order.id, description: `  ➕ AGGIUNGI: ${item.addedIngredients.map(x => x.name).join(", ")}`, zone, completed: false });
      if (item.notes)
        await createKitchenTask({ orderId: order.id, description: `  📝 ${item.notes}`, zone, completed: false });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const inAttesa      = orders.filter(o => o.status === "attesa" || o.status === "preparazione");
  const inPreparazione = orders.filter(o => o.status === "pronto");
  const conclusi      = orders.filter(o => o.status === "consegnato");

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white text-2xl font-bold">🍕 Preparazione</h1>
        <div className="flex gap-2 text-xs text-gray-400">
          <span className="bg-gray-700 px-2 py-1 rounded-lg">⏳ Attesa: {inAttesa.length}</span>
          <span className="bg-yellow-700 px-2 py-1 rounded-lg text-yellow-200">🔧 Prep.: {inPreparazione.length}</span>
          <span className="bg-gray-700 px-2 py-1 rounded-lg">✅ Conclusi: {conclusi.length}</span>
        </div>
      </div>

      {/* 3 colonne */}
      <div className="flex gap-3 flex-1 overflow-hidden">

        {/* ═══ IN ATTESA (status: attesa | preparazione) ═══ */}
        <div className="w-56 flex flex-col gap-2 overflow-hidden">
          <h2 className="text-gray-300 font-bold text-sm shrink-0 bg-gray-700/50 rounded-lg px-3 py-2">
            ⏳ In attesa ({inAttesa.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {inAttesa.length === 0 && (
              <p className="text-gray-600 text-xs text-center mt-6">Nessun ordine in attesa</p>
            )}
            {inAttesa.map(order => {
              const minutes = minutesSince(order.createdAt);
              return (
                <div key={order.id}
                  className={`bg-gray-800 rounded-xl border p-3 ${
                    order.isUrgent || minutes >= 20 ? "border-red-500" :
                    minutes >= 12 ? "border-yellow-500" : "border-gray-700"
                  }`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-white text-xs font-bold leading-tight">{orderLabel(order)}</p>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 ${
                      order.isUrgent || minutes >= 20 ? "bg-red-600 text-white" :
                      minutes >= 12 ? "bg-yellow-600 text-white" : "bg-gray-700 text-gray-300"
                    }`}>⏱{minutes}m</span>
                  </div>
                  {order.isUrgent && <p className="text-red-400 text-xs font-bold mb-1 animate-pulse">🔴 URGENTE</p>}
                  <p className="text-gray-500 text-xs mb-2">🕐 {formatTime(order.createdAt)}</p>

                  {/* Prodotti compatti */}
                  <div className="space-y-0.5 mb-2">
                    {order.items.map(i => (
                      <p key={i.cartId} className="text-gray-300 text-xs truncate">
                        {i.quantity > 1 && <span className="text-orange-400">×{i.quantity} </span>}
                        {i.name}
                        {i.size !== "normale" && <span className="text-yellow-500"> [{i.size}]</span>}
                      </p>
                    ))}
                  </div>

                  {/* Stato cucina */}
                  <p className="text-xs mb-2">
                    {order.status === "attesa"
                      ? <span className="text-gray-400">⏳ In coda cucina</span>
                      : <span className="text-yellow-400">🔧 Cucina al lavoro</span>}
                  </p>

                  {/* Invia a cucina */}
                  <div className="flex flex-col gap-1">
                    {order.items.some(i => ["pizze","panini","burger","specialita"].includes(i.category)) && (
                      <button onClick={() => sendToKitchen(order, "cucina")}
                        className="w-full text-xs bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 border border-orange-600/40 rounded-lg py-1 transition-colors">
                        📤 → 🍳 Cucina
                      </button>
                    )}
                    {order.items.some(i => i.category === "fritti") && (
                      <button onClick={() => sendToKitchen(order, "fritture")}
                        className="w-full text-xs bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 border border-yellow-600/40 rounded-lg py-1 transition-colors">
                        📤 → 🍟 Fritture
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ IN PREPARAZIONE (status: pronto) — sempre espanso ═══ */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <h2 className="text-yellow-300 font-bold text-sm shrink-0 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2">
            🔧 In preparazione — da completare ({inPreparazione.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
            {inPreparazione.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">Nessun ordine da finire</p>
              </div>
            )}

            {inPreparazione.map(order => {
              const minutes = minutesSince(order.updatedAt);
              // Costruisci checklist completa
              const allCheckItems: { item: OrderItem; checks: CheckItem[] }[] =
                order.items
                  .filter(i => ["pizze","panini","burger","specialita","fritti"].includes(i.category))
                  .map(i => ({ item: i, checks: buildChecklist(i) }))
                  .filter(x => x.checks.length > 0);

              const totalChecks    = allCheckItems.reduce((s, x) => s + x.checks.length, 0);
              const completedChecks = allCheckItems.reduce((s, x) =>
                s + x.checks.filter(c => isChecked(order.id, `${x.item.cartId}_${c.key}`)).length, 0);
              const allDone = totalChecks > 0 && completedChecks === totalChecks;

              return (
                <div key={order.id}
                  className={`bg-gray-800 rounded-2xl border-2 p-4 ${
                    order.isUrgent || minutes >= 10 ? "border-red-500" : "border-yellow-600"
                  }`}>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-bold text-base">{orderLabel(order)}</p>
                      <div className="flex gap-3 mt-0.5">
                        <p className="text-gray-400 text-xs">🕐 {formatTime(order.createdAt)}</p>
                        {order.desiredTime && <p className="text-blue-300 text-xs">→ {order.desiredTime}</p>}
                        {order.isPaid && <p className="text-green-400 text-xs font-bold">💳 Già pagato</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {order.isUrgent && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold animate-pulse">🔴 URGENTE</span>}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${minutes >= 10 ? "bg-red-600 text-white" : "bg-yellow-600 text-white"}`}>
                        ⏱ {minutes}min
                      </span>
                    </div>
                  </div>

                  {/* Tutti i prodotti dell'ordine */}
                  <div className="space-y-2 mb-4">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Prodotti ordine:</p>
                    {order.items.map(item => (
                      <div key={item.cartId} className="bg-gray-900/60 rounded-xl p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-sm">
                            {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                            {item.name}
                          </span>
                          {item.size !== "normale" && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                              item.size === "maxi" ? "bg-yellow-500/20 text-yellow-300" : "bg-blue-500/20 text-blue-300"
                            }`}>{item.size.toUpperCase()}</span>
                          )}
                        </div>
                        {item.removedIngredients.length > 0 && (
                          <p className="text-red-400 text-sm font-bold">🚫 SENZA: {item.removedIngredients.join(", ")}</p>
                        )}
                        {item.addedIngredients.length > 0 && (
                          <p className="text-green-400 text-sm font-bold">➕ CON: {item.addedIngredients.map(x => x.name).join(", ")}</p>
                        )}
                        {item.notes && (
                          <p className="text-yellow-300 text-sm">📝 {item.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Extra ordine */}
                  {order.extras?.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                      <p className="text-blue-400 text-xs font-bold uppercase mb-1">➕ Extra da includere:</p>
                      {order.extras.map((e, i) => (
                        <p key={i} className="text-blue-200 text-sm font-semibold">• {e.description}</p>
                      ))}
                    </div>
                  )}

                  {/* Note ordine */}
                  {order.orderNotes && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-4">
                      <p className="text-yellow-300 text-sm">📋 {order.orderNotes}</p>
                    </div>
                  )}

                  {/* ── CHECKLIST DI VERIFICA ── */}
                  {allCheckItems.length > 0 && (
                    <div className="bg-gray-900/70 rounded-xl p-3 mb-4 border border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-white text-sm font-bold uppercase tracking-wide">
                          ✅ Lista di verifica
                        </p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          allDone ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"
                        }`}>
                          {completedChecks}/{totalChecks}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {allCheckItems.map(({ item, checks }) => (
                          <div key={item.cartId}>
                            <p className="text-gray-400 text-xs font-semibold mb-1.5">
                              {item.quantity > 1 ? `×${item.quantity} ` : ""}{item.name}
                              {item.size !== "normale" ? ` [${item.size}]` : ""}:
                            </p>
                            <div className="space-y-1.5 pl-2">
                              {checks.map(check => {
                                const ck = `${item.cartId}_${check.key}`;
                                const done = isChecked(order.id, ck);
                                return (
                                  <button key={ck}
                                    onClick={() => toggleCheck(order.id, ck)}
                                    className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border transition-all ${
                                      done
                                        ? "bg-green-900/30 border-green-700/50 opacity-60"
                                        : "bg-gray-800 border-gray-600 hover:border-gray-400"
                                    }`}>
                                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs transition-all ${
                                      done ? "border-green-500 bg-green-500" : "border-gray-500"
                                    }`}>
                                      {done && "✓"}
                                    </span>
                                    <span className={`text-sm ${done ? "line-through text-gray-500" : checkColor[check.type]}`}>
                                      {checkIcon[check.type]} {check.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottone consegna */}
                  <button
                    onClick={() => updateOrderStatus(order.id, "consegnato")}
                    disabled={totalChecks > 0 && !allDone}
                    className={`w-full font-bold py-3 rounded-xl text-base transition-all ${
                      totalChecks === 0 || allDone
                        ? "bg-green-600 hover:bg-green-500 text-white"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}>
                    {totalChecks > 0 && !allDone
                      ? `⏳ Completa la checklist (${completedChecks}/${totalChecks})`
                      : "🚀 Consegnato"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ CONCLUSI (status: consegnato) — collassati ═══ */}
        <div className="w-64 flex flex-col gap-2 overflow-hidden">
          <h2 className="text-green-300 font-bold text-sm shrink-0 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
            ✅ Conclusi ({conclusi.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {conclusi.length === 0 && (
              <p className="text-gray-600 text-xs text-center mt-6">Nessun ordine concluso</p>
            )}
            {conclusi.map(order => {
              const isOpen = expanded.has(order.id);
              return (
                <div key={order.id}
                  className="bg-gray-800/80 rounded-xl border border-gray-700 overflow-hidden">

                  {/* Header sempre visibile — click per espandere */}
                  <button
                    onClick={() => toggleExpanded(order.id)}
                    className="w-full p-3 text-left flex items-center justify-between gap-2 hover:bg-gray-700/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs font-bold truncate">{orderLabel(order)}</p>
                      <div className="flex gap-2 mt-0.5">
                        <p className="text-gray-500 text-xs">{formatTime(order.createdAt)}</p>
                        {order.isPaid && <p className="text-green-500 text-xs">💳</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-orange-400 text-xs font-bold">€{order.total.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Dettaglio espanso */}
                  {isOpen && (
                    <div className="border-t border-gray-700 p-3 space-y-2">
                      {order.items.map(item => (
                        <div key={item.cartId} className="text-xs text-gray-400">
                          <span className="text-gray-200">
                            {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                            {item.name}
                            {item.size !== "normale" && <span className="text-yellow-500"> [{item.size}]</span>}
                          </span>
                          {item.removedIngredients.length > 0 && (
                            <p className="text-red-400 pl-2">✗ {item.removedIngredients.join(", ")}</p>
                          )}
                          {item.addedIngredients.length > 0 && (
                            <p className="text-green-400 pl-2">+ {item.addedIngredients.map(x => x.name).join(", ")}</p>
                          )}
                          {item.notes && <p className="text-yellow-300 pl-2">📝 {item.notes}</p>}
                        </div>
                      ))}
                      {order.extras?.map((e, i) => (
                        <p key={i} className="text-blue-300 text-xs">+ {e.description}</p>
                      ))}
                      {order.orderNotes && (
                        <p className="text-yellow-300 text-xs bg-yellow-500/10 rounded p-1.5">📋 {order.orderNotes}</p>
                      )}
                      {order.isPaid && (
                        <p className="text-green-400 text-xs font-semibold">
                          ✅ Pagato {order.paymentMethod === "contanti" ? "💵 contanti" : "💳 carta"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}