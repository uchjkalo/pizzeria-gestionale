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

// Classi CSS per urgenza - Dark Theme Freddo
const urgencyBorder = (m: number, u: boolean) =>
  u || m >= 20 ? "border-red-500 bg-red-950/20" : m >= 12 ? "border-red-700 bg-red-950/10" : "border-gray-600 bg-gray-800";

const urgencyBadge = (m: number, u: boolean) =>
  u || m >= 20 ? "bg-red-600 text-white" : m >= 12 ? "bg-red-700 text-white" : "bg-gray-700 text-gray-200";

// Mappa ingredienti → task di preparazione
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

// Preset task rapide
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

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-900">Caricamento...</p></div>;

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

  // ─── ORDER CARD (Dark Theme Professionale) ───
  const OrderCard = ({ order }: { order: Order }) => {
    const minutes    = minutesSince(order.createdAt);
    const relItems   = order.items.filter(i => cats.includes(i.category));
    const isDeleting = confirmDelete === order.id;
    
    return (
      <div className={`rounded-xl border p-5 transition-all shadow-lg hover:shadow-xl ${urgencyBorder(minutes, order.isUrgent)}`}>
        {/* Header: Tipo, Status, Urgenza */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap gap-2 flex-1">
            <span className="bg-gray-200 text-gray-900 px-3 py-1.5 rounded-full text-sm font-semibold">
              {order.type === "tavolo" ? `🪑 T${order.tableNumber}` : order.type === "asporto" ? `🥡 ${order.customerName || "Asporto"}` : `🚴 ${order.customerName || "Delivery"}`}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${order.status === "attesa" ? "bg-gray-700/60 text-gray-200" : order.status === "preparazione" ? "bg-red-900/50 text-red-200" : "bg-red-800/60 text-red-200"}`}>
              {order.status === "attesa" ? "⏳ Attesa" : order.status === "preparazione" ? "🔧 In prep." : "✅ Pronto"}
            </span>
            {order.isUrgent && <span className="bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">🔴 URGENTE</span>}
            {order.isPaid && <span className="bg-red-900/40 text-red-200 px-2.5 py-1 rounded-full text-xs font-bold">💳 Pagato</span>}
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ml-2 ${urgencyBadge(minutes, order.isUrgent)}`}>⏱ {minutes}m</span>
        </div>

        {order.desiredTime && <p className="text-red-200 text-sm mb-3 font-medium">🕐 Pronto per le {order.desiredTime}</p>}

        {/* Items */}
        <div className="space-y-2 mb-4">
          {relItems.map(item => (
            <div key={item.cartId} className={`rounded-lg p-3 border ${item.id === "custom_pizza" ? "bg-red-900/30 border-red-700" : "bg-gray-300/20 border-gray-400"}`}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {item.id === "custom_pizza" && <span className="text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded font-bold">🎨 PERSONALIZZATA</span>}
                <span className={`font-bold text-base ${item.id === "custom_pizza" ? "text-red-200" : "text-gray-200"}`}>
                  {item.quantity > 1 && <span className="text-red-400">×{item.quantity} </span>}{item.name}
                </span>
                {item.size !== "normale" && <span className={`text-sm px-2 py-0.5 rounded font-bold ${item.size === "maxi" ? "bg-red-700/50 text-red-100" : "bg-gray-700/60 text-gray-200"}`}>{item.size.toUpperCase()}</span>}
              </div>
              {item.isHalf && item.halfPizza1 && item.halfPizza2 && <p className="text-red-200 text-sm font-bold mb-1">½ {item.halfPizza1.name} + ½ {item.halfPizza2.name}</p>}
              {item.removedIngredients.length > 0 && <p className="text-red-400 font-bold">🚫 SENZA: {item.removedIngredients.join(", ")}</p>}
              {item.addedIngredients.length > 0   && <p className="text-gray-200 font-bold">➕ AGGIUNGI: {item.addedIngredients.map(i => i.name).join(", ")}</p>}
              {item.manualAdditions?.length > 0   && <p className="text-red-200 font-bold">✏️ EXTRA: {item.manualAdditions.map(m => m.name).join(", ")}</p>}
              {item.notes && <p className="text-gray-200">📝 {item.notes}</p>}
            </div>
          ))}
        </div>

        {order.orderNotes && <div className="bg-red-950/40 border border-red-700 rounded-lg p-3 mb-4"><p className="text-red-200 text-sm font-medium">📋 {order.orderNotes}</p></div>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-2">
          {order.status === "attesa" && (
            <button onClick={() => handleStartPrep(order)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md hover:shadow-lg">
              🔧 Inizia Prep
            </button>
          )}
          {order.status === "preparazione" && (
            <button onClick={() => updateOrderStatus(order.id, "pronto")}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md hover:shadow-lg">
              ✅ Segna Pronto
            </button>
          )}
          {order.status === "pronto" && <div className="flex-1 text-center text-red-200 font-bold py-2.5 rounded-lg bg-red-950/30 border border-red-700">✅ Pronto!</div>}
          <button
            onClick={async () => {
              for (const d of autoTasksFromOrder(order))
                await createKitchenTask({ orderId: order.id, description: d, zone, completed: false });
              setMobileTab("task");
            }}
            className="bg-gray-300 hover:bg-gray-400 text-gray-950 text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors">
            📋 Auto-Task
          </button>
        </div>

        {isDeleting ? (
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleCancelOrder(order.id)} className="flex-1 bg-red-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-red-500">🗑 Sì, elimina</button>
            <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-300 text-gray-950 text-sm py-2 rounded-lg hover:bg-gray-400">✗ Annulla</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(order.id)} className="w-full text-gray-400 hover:text-red-400 text-xs py-2 rounded-lg hover:bg-red-950/30 transition-colors font-medium">🗑 Elimina ordine</button>
        )}
      </div>
    );
  };

  // ─── TASK PANEL ───
  const TaskPanel = () => (
    <div className="flex flex-col h-full overflow-hidden bg-gray-200">

      {/* Input Task */}
      <div className="shrink-0 p-4 space-y-3 border-b border-gray-300">
        <div className="flex gap-2">
          <input value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreateTask(newTask)}
            placeholder="Nuova task..."
            className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-600 border border-gray-600 focus:border-red-600 placeholder-gray-500" />
          <button onClick={() => handleCreateTask(newTask)} className="bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 font-bold text-lg transition-colors">+</button>
        </div>

        {/* Preset buttons */}
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TASKS[zone].map(preset => (
              <button key={preset} onClick={() => handleCreateTask(preset)}
                className="bg-gray-700 hover:bg-gray-600 active:bg-red-600/30 text-gray-300 text-xs px-3 py-1.5 rounded-full border border-gray-600 transition-colors font-medium hover:border-red-600">
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task attive */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tasks.length === 0 && (
          <div className="text-center text-gray-500 mt-8"><p className="text-3xl mb-2">✅</p><p className="text-sm font-medium">Nessun task attivo</p></div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-700 rounded-lg p-3 border border-gray-600 group hover:shadow-md transition-all">
            {editingTaskId === task.id ? (
              <div className="flex gap-2">
                <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingTaskId(null); }}
                  className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-600 border border-gray-600" />
                <button onClick={handleSaveEdit} className="text-red-300 text-sm font-bold px-2">✓</button>
                <button onClick={() => setEditingTaskId(null)} className="text-gray-400 text-sm px-2">✗</button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <button onClick={() => completeTask(task.id)}
                  className="w-6 h-6 rounded-full border-2 border-gray-500 hover:border-red-500 hover:bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5 transition-all active:scale-90">
                  <span className="text-red-300 text-sm opacity-0 group-hover:opacity-100 font-bold">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug font-medium ${task.description.startsWith("  ") ? "text-gray-500 text-xs pl-2" : "text-gray-100"}`}>
                    {task.description}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">{formatTime(task.createdAt)}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingTaskId(task.id); setEditingText(task.description); }}
                    className="w-6 h-6 text-gray-500 hover:text-red-300 flex items-center justify-center text-sm transition-colors">✏️</button>
                  <button onClick={() => deleteTask(task.id)}
                    className="w-6 h-6 text-gray-500 hover:text-red-400 flex items-center justify-center text-sm transition-colors">✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tutte le task (toggle) */}
      <div className="border-t border-gray-700 shrink-0">
        <button onClick={() => setShowAll(s => !s)}
          className="w-full px-4 py-3 text-gray-500 text-sm flex items-center justify-between hover:text-gray-300 hover:bg-gray-700/50 transition-colors font-medium">
          <span>📋 Archivio ({allTasks.length})</span>
          <span>{showAllTasks ? "▲" : "▼"}</span>
        </button>
        {showAllTasks && (
          <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-1.5">
            {allTasks.map(t => (
              <div key={t.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${t.completed ? "bg-gray-700/50" : "bg-gray-700 border border-gray-600"}`}>
                <span className={`text-sm shrink-0 font-semibold ${t.completed ? "text-red-300" : "text-gray-500"}`}>{t.completed ? "✓" : "○"}</span>
                {editingTaskId === t.id ? (
                  <div className="flex gap-2 flex-1">
                    <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingTaskId(null); }}
                      className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-2 py-1 text-xs outline-none border border-gray-600 focus:ring-2 focus:ring-red-600" />
                    <button onClick={handleSaveEdit} className="text-red-300 text-xs font-bold">✓</button>
                    <button onClick={() => setEditingTaskId(null)} className="text-gray-400 text-xs">✗</button>
                  </div>
                ) : (
                  <>
                    <span className={`text-xs flex-1 ${t.completed ? "line-through text-gray-600" : "text-gray-300"}`}>{t.description}</span>
                    <span className="text-gray-600 text-[10px] shrink-0">{formatTime(t.createdAt)}</span>
                    <button onClick={() => { setEditingTaskId(t.id); setEditingText(t.description); }}
                      className="text-gray-500 hover:text-red-300 text-sm shrink-0 w-5 h-5 flex items-center justify-center transition-colors">✏️</button>
                    <button onClick={() => deleteTask(t.id)}
                      className="text-gray-500 hover:text-red-400 text-sm shrink-0 w-5 h-5 flex items-center justify-center transition-colors">✕</button>
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
    <div className="h-[calc(100vh-100px)] md:h-[calc(100vh-80px)] flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-gray-700 bg-gray-800">
        <h1 className="text-gray-900 text-2xl md:text-3xl font-bold">{zoneLabel}</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm font-medium hidden sm:inline">{formatTime(now)}</span>
          <div className="flex items-center gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${orders.length > 0 ? "bg-red-600 text-white shadow-lg" : "bg-gray-700 text-gray-300"}`}>
              {orders.length} ordini
            </span>
            {tasks.length > 0 && <span className="bg-red-600 text-white px-3 py-2 rounded-full text-xs font-bold shadow-lg">{tasks.length} task</span>}
          </div>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-2 px-4 py-3 shrink-0 bg-gray-800 border-b border-gray-700">
        <button onClick={() => setMobileTab("ordini")}
          className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all relative ${mobileTab === "ordini" ? "bg-red-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
          📋 Ordini
          {orders.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{orders.length}</span>}
        </button>
        <button onClick={() => setMobileTab("task")}
          className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all relative ${mobileTab === "task" ? "bg-red-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
          ✅ Task
          {tasks.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{tasks.length}</span>}
        </button>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 md:gap-5 p-4 md:p-6">
        {/* Mobile content */}
        <div className="md:hidden flex-1 overflow-hidden flex flex-col">
          {mobileTab === "ordini" ? (
            <div className="flex-1 overflow-y-auto space-y-3">
              {orders.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-4xl mb-2">☕</p><p className="font-medium">Nessun ordine</p></div>}
              {orders.map(o => <OrderCard key={o.id} order={o} />)}
            </div>
          ) : (
            <TaskPanel />
          )}
        </div>

        {/* Desktop 2-col layout */}
        <div className="hidden md:flex gap-5 flex-1 overflow-hidden">
          {/* Orders column */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4 shrink-0 text-xs text-gray-500 px-1 font-semibold">
              <span>Legenda:</span>
              <span className="text-gray-300">ok</span>
              <span className="text-red-300">12+ min</span>
              <span className="text-red-400">20+ min / urgente</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {orders.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-4xl mb-2">☕</p><p className="font-medium">Nessun ordine</p></div>}
              {orders.map(o => <OrderCard key={o.id} order={o} />)}
            </div>
          </div>

          {/* Task Panel */}
          <div className="w-96 bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0 bg-gray-750">
              <h2 className="text-gray-100 font-bold text-lg">📋 Task</h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tasks.length > 0 ? "bg-red-600 text-white" : "bg-gray-700 text-gray-400"}`}>{tasks.length}</span>
            </div>
            <div className="flex-1 overflow-hidden"><TaskPanel /></div>
          </div>
        </div>
      </main>
    </div>
  );
}
