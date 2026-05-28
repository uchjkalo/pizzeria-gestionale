"use client";
/* ═══════════════════════════════════════════════════════
   PREPARAZIONE — zona di primo assemblaggio.
   Mostra ordini in stato "in_preparazione" con checklist
   per ingredienti base, preparazione impasto, ecc.
   Quando tutto è OK → marca come "pronto".
═══════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, updateOrderStatus } from "@/lib/orders";
import { Order, OrderItem } from "@/types";
import { menu } from "@/lib/menu";

const formatTime = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const minutesSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 60000);
const formatTime = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const minutesSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 60000);
const orderLabel = (o: Order) =>
  o.type === "tavolo" ? `🪑 Tavolo ${o.tableNumber} (${o.peopleCount} pers.)`
  : o.type === "asporto" ? `🥡 ${o.customerName || "Asporto"}`
  : `🚴 ${o.customerName || o.deliveryAddress || "Delivery"}`;
  o.type === "tavolo" ? `🪑 Tavolo ${o.tableNumber} (${o.peopleCount} pers.)`
  : o.type === "asporto" ? `🥡 ${o.customerName || "Asporto"}`
  : `🚴 ${o.customerName || o.deliveryAddress || "Delivery"}`;

const POST_COOKING = new Set([
  "prosciutto crudo san daniele","prosciutto san daniele","prosciutto crudo",
  "rucola","grana padano","pomodorini","bufala","mozzarella di bufala",
  "burrata","granella di pistacchio","semi di papavero","pesto","pomodori secchi",
  "olio al tartufo","maionese","prezzemolo","mortadella","panna","kren",
  "prosciutto cotto","speck","pitina","porchetta","pancetta croccante","guanciale romano",
  "wurstel","nduja calabrese","nduja","salsiccia locale","salsiccia","friarielli",
  "prosciutto crudo san daniele","prosciutto san daniele","prosciutto crudo",
  "rucola","grana padano","pomodorini","bufala","mozzarella di bufala",
  "burrata","granella di pistacchio","semi di papavero","pesto","pomodori secchi",
  "olio al tartufo","maionese","prezzemolo","mortadella","panna","kren",
  "prosciutto cotto","speck","pitina","porchetta","pancetta croccante","guanciale romano",
  "wurstel","nduja calabrese","nduja","salsiccia locale","salsiccia","friarielli",
]);
const isPostCooking = (ing: string) => POST_COOKING.has(ing.toLowerCase().trim());

interface CheckItem { key: string; label: string; type: "remove"|"add"|"note"|"finish" }
interface CheckItem { key: string; label: string; type: "remove"|"add"|"note"|"finish" }

const buildChecklist = (item: OrderItem): CheckItem[] => {
  const menuItem = menu.find(m => m.id === item.id);
  const list: CheckItem[] = [];
  item.removedIngredients.forEach(ing => list.push({ key: `r_${ing}`, label: `Verificare assenza: ${ing}`, type: "remove" }));
  item.addedIngredients.forEach(ing  => list.push({ key: `a_${ing.name}`, label: `Aggiungere: ${ing.name}`, type: "add" }));
  if (item.notes) list.push({ key: "note", label: `Nota: ${item.notes}`, type: "note" });
  item.removedIngredients.forEach(ing => list.push({ key: `r_${ing}`, label: `Verificare assenza: ${ing}`, type: "remove" }));
  item.addedIngredients.forEach(ing  => list.push({ key: `a_${ing.name}`, label: `Aggiungere: ${ing.name}`, type: "add" }));
  if (item.notes) list.push({ key: "note", label: `Nota: ${item.notes}`, type: "note" });
  if (menuItem) {
    menuItem.ingredients
      .filter(ing => !item.removedIngredients.includes(ing) && isPostCooking(ing))
      .forEach(ing => list.push({ key: `f_${ing}`, label: `Post-cottura: ${ing}`, type: "finish" }));
      .forEach(ing => list.push({ key: `f_${ing}`, label: `Post-cottura: ${ing}`, type: "finish" }));
  }
  return list;
};

const checkColor: Record<CheckItem["type"], string> = {
  remove: "text-red-300", add: "text-green-300", note: "text-red-300", finish: "text-blue-300",
};
const checkIcon: Record<CheckItem["type"], string> = { remove: "🚫", add: "➕", note: "📝", finish: "🍕" };
const checkIcon: Record<CheckItem["type"], string> = { remove: "🚫", add: "➕", note: "📝", finish: "🍕" };

export default function RifinituraZone() {
  const { loading } = useAuth();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [now, setNow]         = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"pronti"|"conclusi">("pronti");
  const [orders, setOrders]   = useState<Order[]>([]);
  const [now, setNow]         = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"pronti"|"conclusi">("pronti");
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const audioRef = useRef<AudioContext | null>(null);
  const prevPronto = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const prevPronto = useRef(0);
  const playBeep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current, o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(660, ctx.currentTime);
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current, o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(660, ctx.currentTime);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  useEffect(() => {
    return subscribeToOrdersToday(all => {
      const pronti = all.filter(o => o.status === "pronto").length;
      if (pronti > prevPronto.current) playBeep();
      prevPronto.current = pronti;
      setOrders(all);
    });
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const toggleCheck = (orderId: string, key: string) => {
    setChecked(prev => {
      const s = new Set(prev[orderId] ?? []);
      s.has(key) ? s.delete(key) : s.add(key);
      return { ...prev, [orderId]: s };
    });
  };
  const isChecked = (orderId: string, key: string) => checked[orderId]?.has(key) ?? false;
  const toggleExpanded = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const isChecked = (orderId: string, key: string) => checked[orderId]?.has(key) ?? false;
  const toggleExpanded = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const inPreparazione = orders.filter(o => o.status === "pronto");
  const conclusi       = orders.filter(o => o.status === "consegnato");

  const AssemblyCard = ({ order }: { order: Order }) => {
    const minutes = minutesSince(order.updatedAt);
    const allCI   = order.items.filter(i => ["pizze","panini","burger","specialita","fritti"].includes(i.category))
      .map(i => ({ item: i, checks: buildChecklist(i) })).filter(x => x.checks.length > 0);
    const total   = allCI.reduce((s, x) => s + x.checks.length, 0);
    const done    = allCI.reduce((s, x) => s + x.checks.filter(c => isChecked(order.id, `${x.item.cartId}_${c.key}`)).length, 0);
    const allDone = total > 0 && done === total;

    return (
      <div className={`bg-gray-800 rounded-xl border-2 p-5 transition-all shadow-sm hover:shadow-md ${order.isUrgent || minutes >= 10 ? "border-red-500" : "border-orange-500"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white font-bold text-base">{orderLabel(order)}</p>
            <p className="text-gray-400 text-xs mt-1">🕐 {formatTime(order.createdAt)}{order.desiredTime && <span className="text-blue-300 ml-2">→ {order.desiredTime}</span>}</p>
            {order.isPaid && <p className="text-green-400 text-xs font-bold mt-1">💳 Già pagato</p>}
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${minutes >= 10 ? "bg-red-600 text-white" : "bg-red-600 text-white"}`}>⏱ {minutes}m</span>
        </div>
        {order.isUrgent && <p className="text-red-400 text-sm font-bold mb-4 animate-pulse">🔴 URGENTE</p>}

        {/* Prodotti */}
        <div className="space-y-2 mb-4">
          {order.items.map(item => (
            <div key={item.cartId} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}{item.name}</span>
                {item.size !== "normale" && <span className={`text-xs px-2 py-0.5 rounded font-bold ${item.size === "maxi" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>{item.size.toUpperCase()}</span>}
              </div>
              {item.isHalf && item.halfPizza1 && item.halfPizza2 && <p className="text-purple-300 text-sm font-bold mt-2">½ {item.halfPizza1.name} + ½ {item.halfPizza2.name}</p>}
              {item.removedIngredients.length > 0 && <p className="text-red-300 font-bold text-sm mt-2">🚫 SENZA: {item.removedIngredients.join(", ")}</p>}
              {item.addedIngredients.length > 0   && <p className="text-green-300 font-bold text-sm">➕ CON: {item.addedIngredients.map(x => x.name).join(", ")}</p>}
              {item.notes && <p className="text-red-300 text-sm mt-1">📝 {item.notes}</p>}
            </div>
          ))}
        </div>

        {order.extras?.length > 0 && (
          <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 mb-4">
            <p className="text-blue-300 text-xs font-bold mb-2">➕ Extra:</p>
            {order.extras.map((e, i) => <p key={i} className="text-blue-300 text-sm font-semibold">• {e.description}</p>)}
          </div>
        )}
        {order.orderNotes && <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4"><p className="text-red-300 text-sm font-medium">📋 {order.orderNotes}</p></div>}

        {/* Checklist */}
        {allCI.length > 0 && (
          <div className="bg-gray-900/60 rounded-lg p-4 mb-4 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <p className="text-white text-sm font-bold uppercase">✅ Checklist</p>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${allDone ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}`}>{done}/{total}</span>
            </div>
            <div className="space-y-3">
              {allCI.map(({ item, checks }) => (
                <div key={item.cartId}>
                  <p className="text-gray-400 text-xs font-semibold mb-2">{item.quantity > 1 ? `×${item.quantity} ` : ""}{item.name}:</p>
                  <div className="space-y-2 pl-2">
                    {checks.map(check => {
                      const ck = `${item.cartId}_${check.key}`;
                      const d  = isChecked(order.id, ck);
                      return (
                        <button key={ck} onClick={() => toggleCheck(order.id, ck)}
                          className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-lg border-2 transition-all active:scale-[0.98] ${d ? "bg-green-900/40 border-green-700 opacity-70" : "bg-gray-800 border-gray-600 hover:border-orange-500"}`}>
                          <span className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 text-sm font-bold transition-all ${d ? "border-green-600 bg-green-600 text-white" : "border-gray-500"}`}>{d && "✓"}</span>
                          <span className={`text-sm ${d ? "line-through text-gray-500" : checkColor[check.type]}`}>{checkIcon[check.type]} {check.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => updateOrderStatus(order.id, "pronto")} disabled={total > 0 && !allDone}
          className={`w-full font-bold py-3 rounded-lg text-base transition-all active:scale-[0.98] shadow-sm hover:shadow-md ${total === 0 || allDone ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}>
          {total > 0 && !allDone ? `⏳ Completa checklist (${done}/${total})` : "🚀 Pronto!"}
        </button>
      </div>
    );
  };

  const ConclusiList = () => (
    <div className="space-y-2">
      {conclusi.length === 0 && <p className="text-gray-400 text-sm text-center mt-10 font-medium">Nessun ordine pronto</p>}
      {conclusi.map(order => {
        const isOpen = expanded.has(order.id);
        return (
          <div key={order.id} className="bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden hover:shadow-sm transition-shadow">
            <button onClick={() => toggleExpanded(order.id)} className="w-full p-4 text-left flex items-center justify-between gap-2 hover:bg-gray-700/30 active:bg-gray-700/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm font-bold truncate">{orderLabel(order)}</p>
                <div className="flex gap-2 mt-1">
                  <p className="text-gray-400 text-xs">{formatTime(order.createdAt)}</p>
                  {order.isPaid && <p className="text-green-400 text-xs font-bold">💳 Pagato</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-orange-400 text-sm font-bold">€{order.total.toFixed(2)}</span>
                <span className="text-gray-500 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-700 p-4 space-y-1.5 bg-gray-900/40">
                {order.items.map(item => (
                  <div key={item.cartId} className="text-sm text-gray-400">
                    <span className="text-gray-200 font-medium">{item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}{item.name}{item.size !== "normale" && <span className="text-amber-400"> [{item.size}]</span>}</span>
                    {item.removedIngredients.length > 0 && <p className="text-red-400 pl-2 text-xs font-medium">✗ {item.removedIngredients.join(", ")}</p>}
                    {item.addedIngredients.length > 0   && <p className="text-green-400 pl-2 text-xs font-medium">+ {item.addedIngredients.map(x => x.name).join(", ")}</p>}
                    {item.notes && <p className="text-red-300 pl-2 text-xs">📝 {item.notes}</p>}
                  </div>
                ))}
                {order.isPaid && <p className="text-green-400 text-xs font-semibold mt-2">✅ Pagato {order.paymentMethod === "contanti" ? "💵 contanti" : "💳 carta"}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[calc(100vh-100px)] md:h-[calc(100vh-80px)] flex flex-col gap-4 overflow-hidden bg-gray-900 p-4 md:p-6">
      <div className="flex items-center justify-between shrink-0 bg-gray-800 px-6 py-4 rounded-lg border border-gray-700 shadow-sm">
        <h1 className="text-white text-2xl md:text-3xl font-bold">🍕 Preparazione</h1>
        <div className="flex gap-2 text-sm font-bold">
          <span className={`px-4 py-2 rounded-full ${inPreparazione.length > 0 ? "bg-orange-600 text-white shadow-md" : "bg-gray-700 text-gray-400"}`}>👨‍🍳 {inPreparazione.length}</span>
          <span className="bg-green-700 text-green-200 px-4 py-2 rounded-full shadow-md">✅ {conclusi.length}</span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 shrink-0">
        <button onClick={() => setMobileTab("pronti")}
          className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all relative ${mobileTab === "pronti" ? "bg-orange-600 text-white shadow-md" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
          👨‍🍳 In preparazione
          {inPreparazione.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{inPreparazione.length}</span>}
        </button>
        <button onClick={() => setMobileTab("conclusi")}
          className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${mobileTab === "conclusi" ? "bg-green-700 text-white shadow-md" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
          ✅ Pronti ({conclusi.length})
        </button>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileTab === "pronti" ? (
          inPreparazione.length === 0
            ? <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-5xl mb-3">✅</p><p className="font-medium">Nessun ordine in preparazione</p></div>
            : <div className="space-y-3">{inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}</div>
        ) : <ConclusiList />}
      </div>

      {/* Desktop 2-col */}
      <div className="hidden md:flex gap-5 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-orange-300 font-bold text-base shrink-0 bg-orange-900/20 border border-orange-700/30 rounded-lg px-4 py-3 mb-4">
            👨‍🍳 In preparazione ({inPreparazione.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4">
            {inPreparazione.length === 0
              ? <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-5xl mb-3">✅</p><p className="font-medium">Nessun ordine</p></div>
              : inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}
          </div>
        </div>
        <div className="w-80 flex flex-col gap-4 overflow-hidden">
          <h2 className="text-green-300 font-bold text-base shrink-0 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
            ✅ Pronti ({conclusi.length})
          </h2>
          <div className="flex-1 overflow-y-auto"><ConclusiList /></div>
        </div>
      </div>
    </div>
  );
}

