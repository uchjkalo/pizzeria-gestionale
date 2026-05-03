"use client";
/* ═══════════════════════════════════════════════════════
   RIFINITURA — zona di assemblaggio e consegna finale.
   Mostra ordini in stato "pronto" con checklist per
   ingredienti post-cottura, personalizzazioni, extras.
   Quando tutto è OK → marca come "consegnato".
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
  remove: "text-red-400", add: "text-green-400", note: "text-yellow-300", finish: "text-blue-300",
};
const checkIcon: Record<CheckItem["type"], string> = { remove: "🚫", add: "➕", note: "📝", finish: "🍕" };

export default function RifinituraZone() {
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

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const inPreparazione = orders.filter(o => o.status === "pronto");
  const conclusi       = orders.filter(o => o.status === "consegnato");

  /* ─ Card assembly ─ */
  const AssemblyCard = ({ order }: { order: Order }) => {
    const minutes = minutesSince(order.updatedAt);
    const allCI   = order.items.filter(i => ["pizze","panini","burger","specialita","fritti"].includes(i.category))
      .map(i => ({ item: i, checks: buildChecklist(i) })).filter(x => x.checks.length > 0);
    const total   = allCI.reduce((s, x) => s + x.checks.length, 0);
    const done    = allCI.reduce((s, x) => s + x.checks.filter(c => isChecked(order.id, `${x.item.cartId}_${c.key}`)).length, 0);
    const allDone = total > 0 && done === total;

    return (
      <div className={`bg-gray-800 rounded-2xl border-2 p-4 ${order.isUrgent || minutes >= 10 ? "border-red-500" : "border-orange-500"}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-white font-bold text-base">{orderLabel(order)}</p>
            <p className="text-gray-400 text-xs">🕐 {formatTime(order.createdAt)}{order.desiredTime && <span className="text-blue-300 ml-2">→ {order.desiredTime}</span>}</p>
            {order.isPaid && <p className="text-green-400 text-xs font-bold">💳 Già pagato</p>}
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${minutes >= 10 ? "bg-red-600 text-white" : "bg-orange-600 text-white"}`}>⏱{minutes}m</span>
        </div>
        {order.isUrgent && <p className="text-red-400 text-sm font-bold mb-2 animate-pulse">🔴 URGENTE</p>}

        {/* Prodotti */}
        <div className="space-y-2 mb-3">
          {order.items.map(item => (
            <div key={item.cartId} className="bg-gray-900/60 rounded-xl p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}{item.name}</span>
                {item.size !== "normale" && <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${item.size === "maxi" ? "bg-yellow-500/20 text-yellow-300" : "bg-blue-500/20 text-blue-300"}`}>{item.size.toUpperCase()}</span>}
              </div>
              {item.isHalf && item.halfPizza1 && item.halfPizza2 && <p className="text-purple-300 text-sm font-bold mt-1">½ {item.halfPizza1.name} + ½ {item.halfPizza2.name}</p>}
              {item.removedIngredients.length > 0 && <p className="text-red-400 font-bold text-sm mt-1">🚫 SENZA: {item.removedIngredients.join(", ")}</p>}
              {item.addedIngredients.length > 0   && <p className="text-green-400 font-bold text-sm">➕ CON: {item.addedIngredients.map(x => x.name).join(", ")}</p>}
              {item.notes && <p className="text-yellow-300 text-sm">📝 {item.notes}</p>}
            </div>
          ))}
        </div>

        {order.extras?.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5 mb-3">
            <p className="text-blue-400 text-xs font-bold mb-1">➕ Extra:</p>
            {order.extras.map((e, i) => <p key={i} className="text-blue-200 text-sm font-semibold">• {e.description}</p>)}
          </div>
        )}
        {order.orderNotes && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 mb-3"><p className="text-yellow-300 text-sm">📋 {order.orderNotes}</p></div>}

        {/* Checklist */}
        {allCI.length > 0 && (
          <div className="bg-gray-900/70 rounded-xl p-3 mb-4 border border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <p className="text-white text-sm font-bold uppercase">✅ Checklist</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allDone ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"}`}>{done}/{total}</span>
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
                          className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl border transition-all active:scale-[0.98] ${d ? "bg-green-900/30 border-green-700/50 opacity-60" : "bg-gray-800 border-gray-600"}`}>
                          <span className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 text-sm font-bold transition-all ${d ? "border-green-500 bg-green-500 text-white" : "border-gray-500"}`}>{d && "✓"}</span>
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

        <button onClick={() => updateOrderStatus(order.id, "consegnato")} disabled={total > 0 && !allDone}
          className={`w-full font-bold py-4 rounded-2xl text-base transition-all active:scale-[0.98] ${total === 0 || allDone ? "bg-green-600 hover:bg-green-500 text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)]" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}>
          {total > 0 && !allDone ? `⏳ Completa checklist (${done}/${total})` : "🚀 Consegnato!"}
        </button>
      </div>
    );
  };

  /* ─ Conclusi list ─ */
  const ConclusiList = () => (
    <div className="space-y-2">
      {conclusi.length === 0 && <p className="text-gray-600 text-sm text-center mt-10">Nessun ordine concluso</p>}
      {conclusi.map(order => {
        const isOpen = expanded.has(order.id);
        return (
          <div key={order.id} className="bg-gray-800/80 rounded-2xl border border-gray-700 overflow-hidden">
            <button onClick={() => toggleExpanded(order.id)} className="w-full p-4 text-left flex items-center justify-between gap-2 active:bg-gray-700/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm font-bold truncate">{orderLabel(order)}</p>
                <div className="flex gap-2 mt-0.5">
                  <p className="text-gray-500 text-xs">{formatTime(order.createdAt)}</p>
                  {order.isPaid && <p className="text-green-500 text-xs font-bold">💳 Pagato</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-orange-400 text-sm font-bold">€{order.total.toFixed(2)}</span>
                <span className="text-gray-500 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-700 p-4 space-y-1.5">
                {order.items.map(item => (
                  <div key={item.cartId} className="text-sm text-gray-400">
                    <span className="text-gray-200 font-medium">{item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}{item.name}{item.size !== "normale" && <span className="text-yellow-500"> [{item.size}]</span>}</span>
                    {item.removedIngredients.length > 0 && <p className="text-red-400 pl-2 text-xs">✗ {item.removedIngredients.join(", ")}</p>}
                    {item.addedIngredients.length > 0   && <p className="text-green-400 pl-2 text-xs">+ {item.addedIngredients.map(x => x.name).join(", ")}</p>}
                    {item.notes && <p className="text-yellow-300 pl-2 text-xs">📝 {item.notes}</p>}
                  </div>
                ))}
                {order.isPaid && <p className="text-green-400 text-xs font-semibold mt-1">✅ Pagato {order.paymentMethod === "contanti" ? "💵 contanti" : "💳 carta"}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white text-xl md:text-2xl font-bold">📦 Rifinitura</h1>
        <div className="flex gap-1.5 text-xs">
          <span className={`px-2 py-1 rounded-lg font-bold ${inPreparazione.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"}`}>🔧 {inPreparazione.length}</span>
          <span className="bg-green-900 text-green-300 px-2 py-1 rounded-lg font-bold">✅ {conclusi.length}</span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 shrink-0">
        <button onClick={() => setMobileTab("pronti")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors relative ${mobileTab === "pronti" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
          🔧 Da rifinire
          {inPreparazione.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{inPreparazione.length}</span>}
        </button>
        <button onClick={() => setMobileTab("conclusi")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${mobileTab === "conclusi" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
          ✅ Conclusi ({conclusi.length})
        </button>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileTab === "pronti" ? (
          inPreparazione.length === 0
            ? <div className="flex flex-col items-center justify-center h-40 text-gray-600"><p className="text-5xl mb-3">✅</p><p>Nessun ordine da rifinire</p></div>
            : <div className="space-y-3">{inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}</div>
        ) : <ConclusiList />}
      </div>

      {/* Desktop 2-col */}
      <div className="hidden md:flex gap-3 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-orange-300 font-bold text-sm shrink-0 bg-orange-900/20 border border-orange-700/30 rounded-lg px-3 py-2 mb-3">
            🔧 Da rifinire ({inPreparazione.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3">
            {inPreparazione.length === 0
              ? <div className="flex flex-col items-center justify-center h-40 text-gray-600"><p className="text-5xl mb-3">✅</p><p>Nessun ordine</p></div>
              : inPreparazione.map(o => <AssemblyCard key={o.id} order={o} />)}
          </div>
        </div>
        <div className="w-64 flex flex-col gap-2 overflow-hidden">
          <h2 className="text-green-300 font-bold text-sm shrink-0 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
            ✅ Conclusi ({conclusi.length})
          </h2>
          <div className="flex-1 overflow-y-auto"><ConclusiList /></div>
        </div>
      </div>
    </div>
  );
}
