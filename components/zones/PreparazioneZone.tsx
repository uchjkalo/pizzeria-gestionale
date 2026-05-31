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
const orderLabel = (o: Order) =>
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
]);
const isPostCooking = (ing: string) => POST_COOKING.has(ing.toLowerCase().trim());

interface CheckItem { key: string; label: string; type: "remove"|"add"|"note"|"finish" }

const buildChecklist = (item: OrderItem): CheckItem[] => {
  const menuItem = menu.find(m => m.id === item.id);
  const list: CheckItem[] = [];
  item.removedIngredients.forEach(ing => list.push({ key: `r_${ing}`, label: `Verificare assenza: ${ing}`, type: "remove" }));
  item.addedIngredients.forEach(ing  => list.push({ key: `a_${ing.name}`, label: `Aggiungere: ${ing.name}`, type: "add" }));
  if (item.notes) list.push({ key: "note", label: `Nota: ${item.notes}`, type: "note" });
  if (menuItem) {
    menuItem.ingredients
      .filter(ing => !item.removedIngredients.includes(ing) && isPostCooking(ing))
      .forEach(ing => list.push({ key: `f_${ing}`, label: `Post-cottura: ${ing}`, type: "finish" }));
  }
  return list;
};

const checkColor: Record<CheckItem["type"], string> = {
  remove: "text-red-300", add: "text-gray-900", note: "text-gray-700", finish: "text-red-200",
};
const checkIcon: Record<CheckItem["type"], string> = { remove: "🚫", add: "➕", note: "📝", finish: "🍕" };

export default function PreparazioneZone() {
  const { loading } = useAuth();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [now, setNow]         = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"pronti"|"conclusi">("pronti");
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const audioRef = useRef<AudioContext | null>(null);
  const prevPronto = useRef(0);
  const playBeep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current, o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(660, ctx.currentTime);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
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

  const toggleCheck = (orderId: string, key: string) => {
    setChecked(prev => {
      const s = new Set(prev[orderId] ?? []);
      s.has(key) ? s.delete(key) : s.add(key);
      return { ...prev, [orderId]: s };
    });
  };
  const isChecked = (orderId: string, key: string) => checked[orderId]?.has(key) ?? false;
  const toggleExpanded = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-900">Caricamento...</p></div>;

  const inPreparazione = orders.filter(o => o.status === "pronto");
  const inAttesa       = orders.filter(o => o.status === "attesa");
  const conclusi       = orders.filter(o => o.status === "consegnato");

  const AssemblyCard = ({ order }: { order: Order }) => {
    const minutes = minutesSince(order.updatedAt);
    
    return (
      <div className={`bg-gray-100 rounded-2xl border-2 p-5 transition-all shadow-sm hover:shadow-md ${order.isUrgent || minutes >= 10 ? "border-red-500" : "border-gray-400"}`}>
        {/* Header: Info ordine */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-900 font-bold text-base">{orderLabel(order)}</p>
            <p className="text-gray-700 text-xs mt-1">🕐 {formatTime(order.createdAt)}{order.desiredTime && <span className="text-red-600 ml-2">→ {order.desiredTime}</span>}</p>
            {order.isPaid && <p className="text-red-600 text-xs font-bold mt-1">💳 Già pagato</p>}
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 border ${minutes >= 10 ? "bg-red-600 text-white border-red-500" : "bg-gray-200 text-gray-900 border-gray-400"}`}>⏱ {minutes}m</span>
        </div>
        {order.isUrgent && <p className="text-red-600 text-sm font-bold mb-4 animate-pulse">🔴 URGENTE</p>}

        {/* Prodotti con ingredienti visibili */}
        <div className="space-y-3 mb-4">
          {order.items.map(item => (
            <div key={item.cartId} className="bg-gray-50 rounded-lg p-3 border border-gray-300">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-gray-900 font-bold text-sm">{item.quantity > 1 && <span className="text-red-600">×{item.quantity} </span>}{item.name}</span>
                {item.size !== "normale" && <span className={`text-xs px-2 py-0.5 rounded font-bold border ${item.size === "maxi" ? "bg-red-200 border-red-300 text-red-700" : "bg-gray-200 border-gray-400 text-gray-900"}`}>{item.size.toUpperCase()}</span>}
              </div>
              {/* Mostra ingredienti come elenco visibile (Punto 10) */}
              {item.removedIngredients.length > 0 && <p className="text-red-600 font-bold text-sm mt-2">🚫 SENZA: {item.removedIngredients.join(", ")}</p>}
              {item.addedIngredients.length > 0   && <p className="text-gray-900 font-bold text-sm">➕ CON: {item.addedIngredients.map(x => x.name).join(", ")}</p>}
              {item.notes && <p className="text-red-600 text-sm mt-1">📝 {item.notes}</p>}
              {item.isHalf && item.halfPizza1 && item.halfPizza2 && <p className="text-red-600 text-sm font-bold mt-2">½ {item.halfPizza1.name} + ½ {item.halfPizza2.name}</p>}
            </div>
          ))}
        </div>

        {order.extras?.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-xs font-bold mb-2">➕ Extra:</p>
            {order.extras.map((e, i) => <p key={i} className="text-red-700 text-sm font-semibold">• {e.description}</p>)}
          </div>
        )}
        {order.orderNotes && <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4"><p className="text-red-700 text-sm font-medium">📋 {order.orderNotes}</p></div>}

        {/* Bottone Pronto semplice - senza checklist (Punto 10) */}
        <button onClick={() => updateOrderStatus(order.id, "pronto")}
          className="w-full font-bold py-3 rounded-xl text-base transition-all active:scale-[0.98] shadow-sm hover:shadow-md border bg-red-600 hover:bg-red-700 text-white border-red-500">
          🚀 Pronto!
        </button>
      </div>
    );
  };

  const ConclusiList = () => (
    <div className="space-y-2">
      {conclusi.length === 0 && <p className="text-gray-600 text-sm text-center mt-10 font-medium">Nessun ordine pronto</p>}
      {conclusi.map(order => {
        const isOpen = expanded.has(order.id);
        return (
          <div key={order.id} className="bg-gray-100 rounded-xl border border-gray-400 overflow-hidden hover:shadow-sm transition-shadow shadow-sm">
            <button onClick={() => toggleExpanded(order.id)} className="w-full p-4 text-left flex items-center justify-between gap-2 hover:bg-gray-200 active:bg-gray-200 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-sm font-bold truncate">{orderLabel(order)}</p>
                <div className="flex gap-2 mt-1">
                  <p className="text-gray-700 text-xs">{formatTime(order.createdAt)}</p>
                  {order.isPaid && <p className="text-red-600 text-xs font-bold">💳 Pagato</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-red-600 text-sm font-bold">€{order.total.toFixed(2)}</span>
                <span className="text-gray-700 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-300 p-4 space-y-1.5 bg-gray-50">
                {order.items.map(item => (
                  <div key={item.cartId} className="text-sm text-gray-700">
                    <span className="text-gray-900 font-medium">{item.quantity > 1 && <span className="text-red-600">×{item.quantity} </span>}{item.name}{item.size !== "normale" && <span className="text-red-600"> [{item.size}]</span>}</span>
                    {item.removedIngredients.length > 0 && <p className="text-red-600 pl-2 text-xs font-medium">✗ {item.removedIngredients.join(", ")}</p>}
                    {item.addedIngredients.length > 0   && <p className="text-gray-900 pl-2 text-xs font-medium">+ {item.addedIngredients.map(x => x.name).join(", ")}</p>}
                    {item.notes && <p className="text-red-600 pl-2 text-xs">📝 {item.notes}</p>}
                  </div>
                ))}
                {order.isPaid && <p className="text-red-600 text-xs font-semibold mt-2">✅ Pagato {order.paymentMethod === "contanti" ? "💵 contanti" : "💳 carta"}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3 overflow-hidden bg-gray-50 p-4 md:p-6">
      <div className="flex items-center justify-between shrink-0 bg-gray-100 px-6 py-4 rounded-xl border border-gray-300 shadow-sm">
        <h1 className="text-gray-900 text-xl md:text-2xl font-bold">🍕 Preparazione</h1>
        <div className="flex gap-1.5 text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-bold ${inPreparazione.length > 0 ? "bg-red-600 text-white" : "bg-gray-300 text-gray-700"}`}>
            👨‍🍳 {inPreparazione.length}
          </span>
          <span className="bg-green-600 text-white px-2.5 py-1 rounded-lg font-bold">✅ {conclusi.length}</span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 shrink-0">
        <button onClick={() => setMobileTab("pronti")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors relative border ${mobileTab === "pronti" ? "bg-red-600 text-white border-red-500" : "bg-gray-200 text-gray-700 border-gray-300"}`}>
          👨‍🍳 In preparazione
          {inPreparazione.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{inPreparazione.length}</span>
          )}
        </button>
        <button onClick={() => setMobileTab("conclusi")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors border ${mobileTab === "conclusi" ? "bg-green-600 text-white border-green-500" : "bg-gray-200 text-gray-700 border-gray-300"}`}>
          ✅ Pronti ({conclusi.length})
        </button>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileTab === "pronti" ? (
          inPreparazione.length === 0
            ? <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-5xl mb-3">✅</p><p className="font-medium">Nessun ordine in preparazione</p></div>
            : <div className="space-y-3 px-4">{inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}</div>
        ) : <div className="px-4"><ConclusiList /></div>}
      </div>

      {/* Desktop 2-col */}
      <div className="hidden md:flex gap-4 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-gray-900 font-bold text-sm shrink-0 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 mb-3">
            👨‍🍳 In preparazione ({inPreparazione.length})
          </h2>
          <div className="flex-1 overflow-y-auto">
            {inPreparazione.length === 0
              ? <div className="flex flex-col items-center justify-center h-40 text-gray-500"><p className="text-5xl mb-3">✅</p><p className="font-medium">Nessun ordine</p></div>
              : <div className="space-y-4">{inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}</div>}
          </div>
        </div>
        <div className="w-80 flex flex-col overflow-hidden">
          <h2 className="text-gray-900 font-bold text-sm shrink-0 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 mb-3">
            ✅ Pronti ({conclusi.length})
          </h2>
          <div className="flex-1 overflow-y-auto">
            <ConclusiList />
          </div>
        </div>
      </div>
    </div>
  );
}
