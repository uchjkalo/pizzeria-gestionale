"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToActiveOrders, updateOrderStatus, cancelOrder } from "@/lib/orders";
import { subscribeToTasks, subscribeToAllTasks, createKitchenTask, completeTask, deleteTask, updateTaskDescription } from "@/lib/kitchen";
import { Order, KitchenTask } from "@/types";
import { menu } from "@/lib/menu";

interface Props { zone: "cucina" | "fritture" }

const CUCINA_CATS   = ["pizze", "panini", "burger", "specialita"];
const FRITTURE_CATS = ["fritti"];

const formatTime   = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const minutesSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 60000);

const urgencyBorder = (m: number, u: boolean) =>
  u || m >= 20 ? "border-red-500 bg-red-500/10" : m >= 12 ? "border-yellow-500 bg-yellow-500/10" : "border-gray-700 bg-gray-800";

const urgencyBadge = (m: number, u: boolean) =>
  u || m >= 20 ? "bg-red-600 text-white" : m >= 12 ? "bg-yellow-600 text-white" : "bg-gray-700 text-gray-300";

/* ── Mappa ingredienti → task di preparazione (inviate alla zona "preparazione") ── */
const PREP_FROM_INGREDIENT: Record<string, string> = {
  "prosciutto crudo san daniele": "🥩 San Daniele", "prosciutto san daniele": "🥩 San Daniele",
  "prosciutto cotto": "🥩 Prosciutto cotto", "prosciutto cotto stufato": "🥩 Prosciutto cotto",
  "mortadella": "🥩 Mortadella", "pitina": "🥩 Pitina", "porchetta": "🥩 Porchetta",
  "speck": "🥩 Speck", "pancetta croccante": "🥩 Pancetta", "guanciale romano": "🥩 Guanciale",
  "guanciale": "🥩 Guanciale", "nduja calabrese": "🌶️ Nduja", "nduja": "🌶️ Nduja",
  "salsiccia locale": "🥩 Salsiccia", "salsiccia": "🥩 Salsiccia",
  "friarielli": "🌿 Friarielli", "patatine fritte": "🍟 Patatine fritte", "wurstel": "🌭 Wurstel",
  "cotoletta": "🥩 Cotoletta",
};
const PREP_FROM_NAME: Record<string, string> = {
  "cono di patate fritte": "🍟 Cono patatine", "nuggets di pollo": "🍗 Nuggets di pollo",
  "cotoletta e patatine": "🥩 Cotoletta + 🍟 Patatine", "il frico": "🧀 Frico",
};

function generatePrepTasks(order: Order): string[] {
  const seen = new Set<string>();
  const tasks: string[] = [];

  const add = (t: string) => { if (!seen.has(t)) { seen.add(t); tasks.push(t); } };

  for (const item of order.items) {
    const nl = item.name.toLowerCase();
    if (PREP_FROM_NAME[nl]) { add(`${PREP_FROM_NAME[nl]}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`); continue; }
    const menuItem = menu.find(m => m.id === item.id);
    const allIngs  = [...(menuItem?.ingredients ?? []), ...item.addedIngredients.map(i => i.name)];
    for (const ing of allIngs) {
      const t = PREP_FROM_INGREDIENT[ing.toLowerCase()];
      if (t) add(t);
    }
  }
  return tasks;
}

/* ── Preset task rapide per la zona ── */
const PRESET_TASKS: Record<"cucina" | "fritture", string[]> = {
  cucina: [
    "🍕 In cottura", "✅ Pizza pronta", "⏰ In ritardo", "⚠️ Ingrediente mancante",
    "🔄 Rifare ordine", "🌡️ Forno non in temp.", "📞 Contattare cliente", "🔴 STOP cucina",
  ],
  fritture: [
    "🍟 Cono patatine", "🍗 Nuggets", "🍟 Patatine extra", "✅ Fritti pronti",
    "⏰ Olio in riscaldamento", "⚠️ Olio da cambiare", "🔄 Rifare fritto",
  ],
};

export default function KitchenZone({ zone }: Props) {
  const { loading } = useAuth();
  const [orders, setOrders]          = useState<Order[]>([]);
  const [tasks, setTasks]            = useState<KitchenTask[]>([]);
  const [allTasks, setAllTasks]      = useState<KitchenTask[]>([]);
  const [showAllTasks, setShowAll]   = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText]     = useState("");
  const [newTask, setNewTask]        = useState("");
  const [now, setNow]                = useState(new Date());
  const [mobileTab, setMobileTab]    = useState<"ordini" | "task">("ordini");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const audioRef  = useRef<AudioContext | null>(null);
  const prevCount = useRef(0);

  const playBeep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  useEffect(() => {
    const cats = zone === "cucina" ? CUCINA_CATS : FRITTURE_CATS;
    return subscribeToActiveOrders(all => {
      const rel = all.filter(o => o.items.some(i => cats.includes(i.category)) && o.status !== "consegnato");
      if (rel.length > prevCount.current) playBeep();
      prevCount.current = rel.length;
      setOrders(rel);
    });
  }, [zone]);

  useEffect(() => subscribeToTasks(zone, setTasks), [zone]);
  useEffect(() => subscribeToAllTasks(zone, setAllTasks), [zone]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const handleStartPrep = async (order: Order) => {
    await updateOrderStatus(order.id, "preparazione");
    // Auto-genera task per la zona "preparazione"
    const prepTasks = generatePrepTasks(order);
    for (const desc of prepTasks) {
      await createKitchenTask({ orderId: order.id, description: desc, zone: "preparazione", completed: false });
    }
  };

  const handleCreateTask = async (text: string) => {
    const t = text.trim(); if (!t) return;
    await createKitchenTask({ orderId: "manuale", description: t, zone, completed: false });
    setNewTask("");
  };

  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingText.trim()) return;
    await updateTaskDescription(editingTaskId, editingText.trim());
    setEditingTaskId(null); setEditingText("");
  };

  const handleCancelOrder = async (orderId: string) => {
    await cancelOrder(orderId); setConfirmDelete(null);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-white">Caricamento...</p></div>;

  const cats      = zone === "cucina" ? CUCINA_CATS : FRITTURE_CATS;
  const zoneLabel = zone === "cucina" ? "🍳 Cucina" : "🍟 Fritture";

  const autoTasksFromOrder = (order: Order): string[] => {
    return order.items.filter(i => cats.includes(i.category)).flatMap(i => {
      const sz  = i.size !== "normale" ? ` [${i.size.toUpperCase()}]` : "";
      const qty = i.quantity > 1 ? ` ×${i.quantity}` : "";
      const lines: string[] = [`${i.name}${sz}${qty}`];
      if (i.removedIngredients.length > 0) lines.push(`  ✗ SENZA: ${i.removedIngredients.join(", ")}`);
      if (i.addedIngredients.length > 0)   lines.push(`  ➕ AGGIUNGI: ${i.addedIngredients.map(x => x.name).join(", ")}`);
      if (i.manualAdditions?.length > 0)   lines.push(`  ✏️ EXTRA: ${i.manualAdditions.map(m => m.name).join(", ")}`);
      if (i.notes) lines.push(`  📝 ${i.notes}`);
      return lines;
    });
  };

  /* ─── ORDER CARD ─── */
  const OrderCard = ({ order }: { order: Order }) => {
    const minutes    = minutesSince(order.createdAt);
    const relItems   = order.items.filter(i => cats.includes(i.category));
    const isDeleting = confirmDelete === order.id;
    return (
      <div className={`rounded-2xl border-2 p-4 transition-all ${urgencyBorder(minutes, order.isUrgent)}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-wrap gap-2 flex-1">
            <span className="bg-gray-700 text-white px-3 py-1.5 rounded-xl text-sm font-bold">
              {order.type === "tavolo" ? `🪑 T${order.tableNumber}` : order.type === "asporto" ? `🥡 ${order.customerName || "Asporto"}` : `🚴 ${order.customerName || "Delivery"}`}
            </span>
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${order.status === "attesa" ? "bg-gray-600 text-gray-200" : order.status === "preparazione" ? "bg-yellow-600 text-yellow-100" : "bg-green-600 text-green-100"}`}>
              {order.status === "attesa" ? "⏳ Attesa" : order.status === "preparazione" ? "🔧 In prep." : "✅ Pronto"}
            </span>
            {order.isUrgent && <span className="bg-red-600 text-white px-2 py-1 rounded-xl text-xs font-bold animate-pulse">🔴 URGENTE</span>}
            {order.isPaid && <span className="bg-green-800 text-green-200 px-2 py-1 rounded-xl text-xs font-bold">💳 Pagato</span>}
          </div>
          <span className={`text-xs font-bold px-2.5 py-1.5 rounded-xl shrink-0 ml-2 ${urgencyBadge(minutes, order.isUrgent)}`}>⏱{minutes}m</span>
        </div>
        {order.desiredTime && <p className="text-blue-300 text-sm mb-2">🕐 Pronto per le {order.desiredTime}</p>}
        <div className="space-y-2 mb-3">
          {relItems.map(item => (
            <div key={item.cartId} className={`rounded-xl p-3 ${item.id === "custom_pizza" ? "bg-purple-900/30 border border-purple-700/50" : "bg-gray-900/60"}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {item.id === "custom_pizza" && <span className="text-xs bg-purple-600/40 text-purple-300 px-2 py-0.5 rounded font-bold">🎨 PERSONALIZZATA</span>}
                <span className={`font-bold text-base ${item.id === "custom_pizza" ? "text-purple-200" : "text-white"}`}>
                  {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}{item.name}
                </span>
                {item.size !== "normale" && <span className={`text-sm px-2 py-0.5 rounded font-bold ${item.size === "maxi" ? "bg-yellow-500/30 text-yellow-300" : "bg-blue-500/30 text-blue-300"}`}>{item.size.toUpperCase()}</span>}
              </div>
              {item.isHalf && item.halfPizza1 && item.halfPizza2 && <p className="text-purple-300 text-sm font-bold mb-1">½ {item.halfPizza1.name} + ½ {item.halfPizza2.name}</p>}
              {item.removedIngredients.length > 0 && <p className="text-red-400 font-bold">🚫 SENZA: {item.removedIngredients.join(", ")}</p>}
              {item.addedIngredients.length > 0   && <p className="text-green-400 font-bold">➕ AGGIUNGI: {item.addedIngredients.map(i => i.name).join(", ")}</p>}
              {item.manualAdditions?.length > 0   && <p className="text-orange-300 font-bold">✏️ EXTRA: {item.manualAdditions.map(m => m.name).join(", ")}</p>}
              {item.notes && <p className="text-yellow-300">📝 {item.notes}</p>}
            </div>
          ))}
        </div>
        {order.orderNotes && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-3"><p className="text-yellow-300 text-sm">📋 {order.orderNotes}</p></div>}
        <div className="flex flex-wrap gap-2">
          {order.status === "attesa" && (
            <button onClick={() => handleStartPrep(order)}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl transition-colors">
              🔧 Inizia (+ task prep)
            </button>
          )}
          {order.status === "preparazione" && (
            <button onClick={() => updateOrderStatus(order.id, "pronto")}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
              ✅ Pronto
            </button>
          )}
          {order.status === "pronto" && <div className="flex-1 text-center text-green-400 font-bold py-3">✅ Pronto per il ritiro!</div>}
          <button
            onClick={async () => {
              for (const d of autoTasksFromOrder(order))
                await createKitchenTask({ orderId: order.id, description: d, zone, completed: false });
              setMobileTab("task");
            }}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-3 px-4 rounded-xl transition-colors">
            📋 Lista
          </button>
        </div>
        {isDeleting ? (
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleCancelOrder(order.id)} className="flex-1 bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl">🗑 Sì, elimina</button>
            <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-700 text-gray-300 text-sm py-2.5 rounded-xl">✗ Annulla</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(order.id)} className="w-full mt-2 text-gray-600 hover:text-red-400 text-xs py-1.5 rounded-lg hover:bg-red-900/20 transition-colors">🗑 Elimina ordine</button>
        )}
      </div>
    );
  };

  /* ─── TASK PANEL ─── */
  const TaskPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Input libero */}
      <div className="shrink-0 p-3 space-y-2 border-b border-gray-700/40">
        <div className="flex gap-2">
          <input value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreateTask(newTask)}
            placeholder="Task personalizzata..."
            className="flex-1 bg-gray-700 text-white rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 border border-gray-600" />
          <button onClick={() => handleCreateTask(newTask)} className="bg-orange-500 hover:bg-orange-400 text-white rounded-2xl px-4 font-bold text-xl transition-colors">+</button>
        </div>

        {/* Preset buttons */}
        <div>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1.5">Rapide</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TASKS[zone].map(preset => (
              <button key={preset} onClick={() => handleCreateTask(preset)}
                className="bg-gray-700 hover:bg-gray-600 active:bg-orange-500/30 text-gray-300 text-xs px-2.5 py-1.5 rounded-xl border border-gray-600 transition-colors font-medium">
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task attive */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <div className="text-center text-gray-600 mt-8"><p className="text-3xl mb-2">✅</p><p className="text-sm">Nessun task attivo</p></div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-700 rounded-2xl p-3 border border-gray-600 group">
            {editingTaskId === task.id ? (
              <div className="flex gap-2">
                <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingTaskId(null); }}
                  className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={handleSaveEdit} className="text-green-400 text-sm font-bold px-2">✓</button>
                <button onClick={() => setEditingTaskId(null)} className="text-gray-500 text-sm px-2">✗</button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <button onClick={() => completeTask(task.id)}
                  className="w-8 h-8 rounded-full border-2 border-gray-400 hover:border-green-400 hover:bg-green-400/20 flex items-center justify-center shrink-0 mt-0.5 transition-all active:scale-90">
                  <span className="text-green-400 text-sm opacity-0 group-hover:opacity-100">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${task.description.startsWith("  ") ? "text-gray-400 text-xs pl-2" : "text-white font-medium"}`}>
                    {task.description}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">{formatTime(task.createdAt)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditingTaskId(task.id); setEditingText(task.description); }}
                    className="w-8 h-8 text-gray-600 hover:text-blue-400 flex items-center justify-center text-sm transition-colors">✏️</button>
                  <button onClick={() => deleteTask(task.id)}
                    className="w-8 h-8 text-gray-600 hover:text-red-400 flex items-center justify-center text-xl transition-colors">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tutte le task (toggle) */}
      <div className="border-t border-gray-700/40 shrink-0">
        <button onClick={() => setShowAll(s => !s)}
          className="w-full px-4 py-3 text-gray-500 text-sm flex items-center justify-between hover:text-gray-300 transition-colors">
          <span>📋 Tutte le task ({allTasks.length})</span>
          <span>{showAllTasks ? "▲" : "▼"}</span>
        </button>
        {showAllTasks && (
          <div className="max-h-52 overflow-y-auto px-3 pb-3 space-y-1.5">
            {allTasks.map(t => (
              <div key={t.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${t.completed ? "bg-gray-800/40" : "bg-gray-800"}`}>
                <span className={`text-sm shrink-0 ${t.completed ? "text-green-600" : "text-gray-500"}`}>{t.completed ? "✓" : "○"}</span>
                {editingTaskId === t.id ? (
                  <div className="flex gap-2 flex-1">
                    <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingTaskId(null); }}
                      className="flex-1 bg-gray-700 text-white rounded-lg px-2 py-1 text-xs outline-none" />
                    <button onClick={handleSaveEdit} className="text-green-400 text-xs">✓</button>
                    <button onClick={() => setEditingTaskId(null)} className="text-gray-500 text-xs">✗</button>
                  </div>
                ) : (
                  <>
                    <span className={`text-xs flex-1 ${t.completed ? "line-through text-gray-600" : "text-gray-300"}`}>{t.description}</span>
                    <span className="text-gray-700 text-[10px] shrink-0">{formatTime(t.createdAt)}</span>
                    <button onClick={() => { setEditingTaskId(t.id); setEditingText(t.description); }}
                      className="text-gray-600 hover:text-blue-400 text-sm shrink-0 w-6 h-6 flex items-center justify-center">✏️</button>
                    <button onClick={() => deleteTask(t.id)}
                      className="text-gray-600 hover:text-red-400 text-base shrink-0 w-6 h-6 flex items-center justify-center">×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-70px)] flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h1 className="text-white text-xl md:text-2xl font-bold">{zoneLabel}</h1>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">{formatTime(now)}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${orders.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"}`}>{orders.length} ordini</span>
          {tasks.length > 0 && <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">{tasks.length}</span>}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 mb-3 shrink-0">
        <button onClick={() => setMobileTab("ordini")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors relative ${mobileTab === "ordini" ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"}`}>
          📋 Ordini
          {orders.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{orders.length}</span>}
        </button>
        <button onClick={() => setMobileTab("task")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors relative ${mobileTab === "task" ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"}`}>
          ✅ Task
          {tasks.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{tasks.length}</span>}
        </button>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        {mobileTab === "ordini" ? (
          <div className="flex-1 overflow-y-auto space-y-3">
            {orders.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-600"><p className="text-4xl mb-2">☕</p><p>Nessun ordine</p></div>}
            {orders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        ) : (
          <TaskPanel />
        )}
      </div>

      {/* Desktop 2-col */}
      <div className="hidden md:flex gap-4 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 mb-3 shrink-0 text-xs text-gray-500">
            <span>Legenda:</span>
            <span className="text-gray-400">ok</span>
            <span className="text-yellow-400">12+ min</span>
            <span className="text-red-400">20+ min / urgente</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {orders.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-600"><p className="text-4xl mb-2">☕</p><p>Nessun ordine</p></div>}
            {orders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
        <div className="w-80 bg-gray-800 rounded-2xl border border-gray-700 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
            <h2 className="text-white font-bold">📋 Task</h2>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${tasks.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"}`}>{tasks.length}</span>
          </div>
          <div className="flex-1 overflow-hidden"><TaskPanel /></div>
        </div>
      </div>
    </div>
  );
}
