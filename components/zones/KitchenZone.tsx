"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToActiveOrders } from "@/lib/orders";
import { subscribeToTasks, subscribeToCompletedTasks, createKitchenTask, completeTask, deleteTask } from "@/lib/kitchen";
import { Order, KitchenTask, OrderItem } from "@/types";

interface Props {
  zone: "cucina" | "fritture";
}

// Categorie rilevanti per zona
const CUCINA_CATEGORIES  = ["pizze", "panini", "burger", "specialita"];
const FRITTURE_CATEGORIES = ["fritti"];

// Formatta data/ora
const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

// Calcola minuti passati
const minutesSince = (date: Date) =>
  Math.floor((Date.now() - date.getTime()) / 60000);

// Colore urgenza in base ai minuti
const urgencyColor = (minutes: number, isUrgent: boolean) => {
  if (isUrgent || minutes >= 20) return "border-red-500 bg-red-500/10";
  if (minutes >= 12)             return "border-yellow-500 bg-yellow-500/10";
  return                                "border-gray-600 bg-gray-800";
};

const urgencyBadge = (minutes: number, isUrgent: boolean) => {
  if (isUrgent)      return "bg-red-600 text-white animate-pulse";
  if (minutes >= 20) return "bg-red-600 text-white";
  if (minutes >= 12) return "bg-yellow-600 text-white";
  return                    "bg-gray-600 text-gray-200";
};

export default function KitchenZone({ zone }: Props) {
  const { loading } = useAuth();
  const [orders, setOrders]              = useState<Order[]>([]);
  const [tasks, setTasks]                = useState<KitchenTask[]>([]);
  const [completedTasks, setCompleted]   = useState<KitchenTask[]>([]);
  const [showCompleted, setShowCompleted]= useState(false);
  const [newTaskText, setNewTaskText]    = useState("");
  const [now, setNow]                    = useState(new Date());

  // Suono notifica nuovo ordine
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  // Clock che si aggiorna ogni minuto per ricalcolare urgenze
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Realtime ordini
  const prevOrderCount = useRef(0);
  useEffect(() => {
    return subscribeToActiveOrders((all) => {
      const relevant = all.filter(o =>
        o.items.some(i =>
          (zone === "cucina" ? CUCINA_CATEGORIES : FRITTURE_CATEGORIES).includes(i.category)
        ) && o.status !== "consegnato"
      );
      if (relevant.length > prevOrderCount.current) playBeep();
      prevOrderCount.current = relevant.length;
      setOrders(relevant);
    });
  }, [zone]);

  // Realtime task
  useEffect(() => subscribeToTasks(zone, setTasks), [zone]);
  useEffect(() => subscribeToCompletedTasks(zone, setCompleted), [zone]);

  // Crea task personalizzato
  const handleCreateTask = async () => {
    if (!newTaskText.trim()) return;
    await createKitchenTask({
      orderId: "manuale",
      description: newTaskText.trim(),
      zone,
      completed: false,
    });
    setNewTaskText("");
  };

  // Genera task automatici dagli ordini
  const autoTasksFromOrder = (order: Order): string[] => {
    const relevantCategories = zone === "cucina" ? CUCINA_CATEGORIES : FRITTURE_CATEGORIES;
    return order.items
      .filter(i => relevantCategories.includes(i.category))
      .flatMap(i => {
        const lines: string[] = [];
        const sizeLabel = i.size !== "normale" ? ` [${i.size.toUpperCase()}]` : "";
        const qty = i.quantity > 1 ? ` ×${i.quantity}` : "";
        lines.push(`${i.name}${sizeLabel}${qty}`);
        if (i.removedIngredients.length > 0)
          lines.push(`  ✗ senza: ${i.removedIngredients.join(", ")}`);
        if (i.addedIngredients.length > 0)
          lines.push(`  + aggiungi: ${i.addedIngredients.map(x => x.name).join(", ")}`);
        if (i.notes)
          lines.push(`  📝 ${i.notes}`);
        return lines;
      });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const zoneLabel   = zone === "cucina" ? "🍳 Cucina" : "🍟 Fritture";
  const accentColor = zone === "cucina" ? "orange" : "yellow";

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">

      {/* ════ COLONNA SINISTRA: Ordini attivi ════ */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <h1 className={`text-white text-2xl font-bold`}>{zoneLabel}</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">{formatTime(now)}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              orders.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"
            }`}>
              {orders.length} ordini
            </span>
          </div>
        </div>

        {/* Legenda urgenza */}
        <div className="flex gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-600 inline-block"/>normale</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"/>attesa 12+ min</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/>attesa 20+ min o urgente</span>
        </div>

        {/* Lista ordini */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <p className="text-5xl mb-3">☕</p>
              <p className="text-lg font-medium">Nessun ordine in coda</p>
              <p className="text-sm mt-1">Gli ordini appariranno qui in tempo reale</p>
            </div>
          )}

          {orders.map(order => {
            const minutes   = minutesSince(order.createdAt);
            const autoTasks = autoTasksFromOrder(order);
            const relevantItems = order.items.filter(i =>
              (zone === "cucina" ? CUCINA_CATEGORIES : FRITTURE_CATEGORIES).includes(i.category)
            );

            return (
              <div key={order.id}
                className={`rounded-2xl border-2 p-4 transition-all ${urgencyColor(minutes, order.isUrgent)}`}>

                {/* Header ordine */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Tipo */}
                    <span className="bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg text-sm font-bold">
                      {order.type === "tavolo"
                        ? `🪑 T${order.tableNumber}`
                        : order.type === "asporto"
                        ? `🥡 ${order.customerName || "Asporto"}`
                        : `🚴 ${order.customerName || order.deliveryAddress || "Delivery"}`}
                    </span>
                    {/* Stato */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      order.status === "attesa"
                        ? "bg-gray-600 text-gray-200"
                        : order.status === "preparazione"
                        ? "bg-yellow-600 text-yellow-100"
                        : "bg-green-600 text-green-100"
                    }`}>
                      {order.status === "attesa"
                        ? "⏳ In attesa"
                        : order.status === "preparazione"
                        ? "🔧 In prep."
                        : "✅ Pronto"}
                    </span>
                    {order.isUrgent && (
                      <span className="bg-red-600 text-white px-2 py-0.5 rounded-lg text-xs font-bold animate-pulse">
                        🔴 URGENTE
                      </span>
                    )}
                  </div>

                  {/* Timer */}
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${urgencyBadge(minutes, order.isUrgent)}`}>
                    ⏱ {minutes}min
                  </span>
                </div>

                {/* Orario desiderato */}
                {order.desiredTime && (
                  <p className="text-blue-300 text-xs mb-2">🕐 Pronto per le {order.desiredTime}</p>
                )}

                {/* Prodotti rilevanti per questa zona */}
                <div className="space-y-2 mb-3">
                  {relevantItems.map(item => (
                    <div key={item.cartId} className="bg-gray-900/50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold">
                          {item.quantity > 1 && (
                            <span className="text-orange-400 mr-1">×{item.quantity}</span>
                          )}
                          {item.name}
                        </span>
                        {item.size !== "normale" && (
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            item.size === "maxi" ? "bg-yellow-500/30 text-yellow-300" : "bg-blue-500/30 text-blue-300"
                          }`}>
                            {item.size.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {item.removedIngredients.length > 0 && (
                        <p className="text-red-400 text-sm font-semibold">
                          🚫 SENZA: {item.removedIngredients.join(", ")}
                        </p>
                      )}
                      {item.addedIngredients.length > 0 && (
                        <p className="text-green-400 text-sm font-semibold">
                          ➕ AGGIUNGI: {item.addedIngredients.map(i => i.name).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-yellow-300 text-sm">📝 {item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Note ordine */}
                {order.orderNotes && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-3">
                    <p className="text-yellow-300 text-sm">📋 {order.orderNotes}</p>
                  </div>
                )}

                {/* Pulsanti cambio stato */}
                <div className="flex gap-2">
                  {order.status === "attesa" && (
                    <button
                      onClick={() => import("@/lib/orders").then(m => m.updateOrderStatus(order.id, "preparazione"))}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold py-2 rounded-xl transition-colors">
                      🔧 Inizia preparazione
                    </button>
                  )}
                  {order.status === "preparazione" && (
                    <button
                      onClick={() => import("@/lib/orders").then(m => m.updateOrderStatus(order.id, "pronto"))}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 rounded-xl transition-colors">
                      ✅ Segna come pronto
                    </button>
                  )}
                  {order.status === "pronto" && (
                    <div className="flex-1 text-center text-green-400 font-bold py-2 text-sm">
                      ✅ Pronto per la consegna!
                    </div>
                  )}
                  {/* Invia task manuale per questo ordine */}
                  <button
                    onClick={async () => {
                      for (const desc of autoTasks) {
                        await createKitchenTask({ orderId: order.id, description: desc, zone, completed: false });
                      }
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 px-3 rounded-xl transition-colors"
                    title="Invia task alla lista">
                    📋 → Lista
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════ COLONNA DESTRA: Task list ════ */}
      <div className="w-72 xl:w-80 bg-gray-800 rounded-2xl flex flex-col overflow-hidden border border-gray-700">

        {/* Header */}
        <div className="p-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">📋 Task attivi</h2>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              tasks.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"
            }`}>
              {tasks.length}
            </span>
          </div>

          {/* Input task manuale */}
          <div className="flex gap-2">
            <input
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateTask()}
              placeholder="Aggiungi task..."
              className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 border border-gray-600"
            />
            <button onClick={handleCreateTask}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-3 font-bold transition-colors">
              +
            </button>
          </div>
        </div>

        {/* Task attivi */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm">Nessun task attivo</p>
            </div>
          )}

          {tasks.map(task => (
            <div key={task.id}
              className="bg-gray-700 rounded-xl p-3 flex items-start gap-3 border border-gray-600 group">
              <button
                onClick={() => completeTask(task.id)}
                className="w-6 h-6 rounded-full border-2 border-gray-400 hover:border-green-400 hover:bg-green-400/20 flex items-center justify-center shrink-0 mt-0.5 transition-all">
                <span className="text-green-400 text-xs opacity-0 group-hover:opacity-100">✓</span>
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${
                  task.description.startsWith("  ") ? "text-gray-400 text-xs pl-2" : "text-white"
                }`}>
                  {task.description}
                </p>
                <p className="text-gray-500 text-xs mt-1">{formatTime(task.createdAt)}</p>
              </div>
              <button onClick={() => deleteTask(task.id)}
                className="text-gray-600 hover:text-red-400 text-lg shrink-0 transition-colors opacity-0 group-hover:opacity-100">
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Completati (espandibile) */}
        <div className="border-t border-gray-700 shrink-0">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="w-full px-4 py-2.5 text-gray-400 hover:text-gray-200 text-sm flex items-center justify-between transition-colors">
            <span>✅ Completati ({completedTasks.length})</span>
            <span className="text-xs">{showCompleted ? "▲" : "▼"}</span>
          </button>
          {showCompleted && (
            <div className="max-h-40 overflow-y-auto px-3 pb-3 space-y-1.5">
              {completedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-green-600">✓</span>
                  <span className="flex-1 line-through truncate">{task.description}</span>
                  <span>{formatTime(task.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}