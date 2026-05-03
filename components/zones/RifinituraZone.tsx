"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, updateOrderStatus } from "@/lib/orders";
import { Order, OrderItem } from "@/types";
import { menu } from "@/lib/menu";

const formatTime = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const minutesSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 60000);

const orderLabel = (o: Order) =>
  o.type === "tavolo"  ? `🪑 Tavolo ${o.tableNumber}` :
  o.type === "asporto" ? `🥡 ${o.customerName || "Asporto"}` :
                         `🚴 ${o.customerName || o.deliveryAddress || "Delivery"}`;

/* ─────────────────────────────────────────────────
   POST-COTTURA — ingredienti da aggiungere dopo
───────────────────────────────────────────────── */
const POST_COOKING = new Set([
  "prosciutto crudo san daniele","prosciutto san daniele","prosciutto crudo",
  "rucola","grana padano","pomodorini","bufala","mozzarella di bufala",
  "burrata","granella di pistacchio","semi di papavero","pesto","pomodori secchi",
  "olio al tartufo","maionese","prezzemolo","mortadella","panna","kren",
  "prosciutto cotto","speck","pitina","porchetta","pancetta croccante","guanciale romano",
  "wurstel","nduja calabrese","nduja","salsiccia locale","salsiccia","friarielli",
]);
const isPostCooking = (ing: string) => POST_COOKING.has(ing.toLowerCase().trim());

/* ─────────────────────────────────────────────────
   PACKAGING — calcola materiali necessari
───────────────────────────────────────────────── */
interface PackItem { icon: string; text: string; count?: number }

function calcPackaging(order: Order): PackItem[] {
  const items = order.items;
  const isTavolo = order.type === "tavolo";

  const pizzeNorm = items.filter(i =>
    i.category === "pizze" &&
    !i.name.toLowerCase().includes("calzone") &&
    !i.name.toLowerCase().includes("romana ripiena")
  ).reduce((s, i) => s + i.quantity, 0);

  const calzoni = items.filter(i =>
    i.category === "pizze" && (
      i.name.toLowerCase().includes("calzone") ||
      i.name.toLowerCase().includes("romana ripiena")
    )
  ).reduce((s, i) => s + i.quantity, 0);

  const panini    = items.filter(i => i.category === "panini").reduce((s, i) => s + i.quantity, 0);
  const burger    = items.filter(i => i.category === "burger").reduce((s, i) => s + i.quantity, 0);
  const fritti    = items.filter(i => i.category === "fritti").reduce((s, i) => s + i.quantity, 0);
  const bibite    = items.filter(i => i.category === "bibite").reduce((s, i) => s + i.quantity, 0);
  const specialita = items.filter(i => i.category === "specialita").reduce((s, i) => s + i.quantity, 0);

  const pack: PackItem[] = [];

  if (isTavolo) {
    // Sul posto: piatti
    if (pizzeNorm > 0 || calzoni > 0 || specialita > 0)
      pack.push({ icon: "🍽️", text: "Piatto", count: pizzeNorm + calzoni + specialita });
    if (panini > 0 || burger > 0)
      pack.push({ icon: "🫕", text: "Piatto piccolo", count: panini + burger });
    if (fritti > 0 || bibite > 0)
      pack.push({ icon: "🛍️", text: "Busta", count: fritti + bibite });
  } else {
    // Asporto / delivery
    if (pizzeNorm > 0) {
      if (pizzeNorm === 1) {
        pack.push({ icon: "📦", text: "1 cartoncino chiuso" });
      } else {
        pack.push({ icon: "📦", text: `${pizzeNorm - 1} apert${pizzeNorm - 1 === 1 ? "o" : "i"} + 1 chiuso` });
      }
    }
    if (calzoni > 0)
      pack.push({ icon: "📦", text: `Cartoncino calzone`, count: calzoni });
    if (panini > 0)
      pack.push({ icon: "📫", text: "Box panino", count: panini });
    if (burger > 0)
      pack.push({ icon: "📫", text: "Box burger", count: burger });
    if (fritti > 0 || bibite > 0) {
      const parts = [
        fritti > 0 ? `${fritti} fritti` : "",
        bibite > 0 ? `${bibite} bibite` : "",
      ].filter(Boolean).join(" + ");
      pack.push({ icon: "🛍️", text: `Busta (${parts})` });
    }
    if (specialita > 0)
      pack.push({ icon: "📦", text: "Box specialità", count: specialita });
  }

  return pack;
}

/* ─────────────────────────────────────────────────
   CHECKLIST — solo le cose rilevanti, compatte
───────────────────────────────────────────────── */
interface CheckChip {
  key: string;
  label: string;
  type: "remove" | "add" | "postcooking" | "note";
  item: string;   // nome prodotto a cui si riferisce
}

function buildChips(order: Order): CheckChip[] {
  const chips: CheckChip[] = [];
  order.items.forEach(item => {
    const menuItem = menu.find(m => m.id === item.id);
    const prefix   = item.quantity > 1 ? `×${item.quantity} ${item.name}` : item.name;

    item.removedIngredients.forEach(ing =>
      chips.push({ key: `r_${item.cartId}_${ing}`, label: ing, type: "remove", item: prefix })
    );
    item.addedIngredients.forEach(ing =>
      chips.push({ key: `a_${item.cartId}_${ing.name}`, label: ing.name, type: "add", item: prefix })
    );
    item.manualAdditions?.forEach(m =>
      chips.push({ key: `m_${item.cartId}_${m.name}`, label: m.name, type: "add", item: prefix })
    );
    if (item.notes)
      chips.push({ key: `n_${item.cartId}`, label: item.notes, type: "note", item: prefix });

    // Post-cottura: ingredienti base che si mettono dopo
    if (menuItem) {
      menuItem.ingredients
        .filter(ing => !item.removedIngredients.includes(ing) && isPostCooking(ing))
        .forEach(ing =>
          chips.push({ key: `pc_${item.cartId}_${ing}`, label: ing, type: "postcooking", item: prefix })
        );
    }
  });
  return chips;
}

const chipStyle: Record<CheckChip["type"], string> = {
  remove:      "bg-red-900/40 border-red-600/40 text-red-300",
  add:         "bg-green-900/40 border-green-600/40 text-green-300",
  postcooking: "bg-blue-900/40 border-blue-600/40 text-blue-300",
  note:        "bg-yellow-900/30 border-yellow-600/30 text-yellow-300",
};
const chipIcon: Record<CheckChip["type"], string> = {
  remove: "✗", add: "＋", postcooking: "🍕", note: "📝",
};

/* ─────────────────────────────────────────────────
   ASSEMBLY CARD — la card principale
───────────────────────────────────────────────── */
interface AssemblyCardProps {
  order: Order;
  tagliata: boolean;
  onToggleTagliata: () => void;
  checked: Set<string>;
  onToggleCheck: (key: string) => void;
  onDeliver: () => void;
}

function AssemblyCard({ order, tagliata, onToggleTagliata, checked, onToggleCheck, onDeliver }: AssemblyCardProps) {
  const minutes = minutesSince(order.updatedAt);
  const chips   = buildChips(order);
  const pack    = calcPackaging(order);
  const allDone = chips.length === 0 || chips.every(c => checked.has(c.key));
  const isAsportoDelivery = order.type !== "tavolo";

  // Raggruppa chip per prodotto
  const grouped = chips.reduce<Record<string, CheckChip[]>>((acc, chip) => {
    if (!acc[chip.item]) acc[chip.item] = [];
    acc[chip.item].push(chip);
    return acc;
  }, {});
  const hasModifications = chips.length > 0;

  return (
    <div className={`bg-gray-800 rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all ${
      order.isUrgent || minutes >= 10 ? "border-red-500" : "border-orange-500"
    }`}>

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-base">{orderLabel(order)}</p>
            {order.isUrgent && (
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                🔴 URGENTE
              </span>
            )}
            {order.isPaid && (
              <span className="bg-green-800 text-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                💳 Pagato
              </span>
            )}
            {tagliata && (
              <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                ✂️ DA TAGLIARE
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            🕐 {formatTime(order.createdAt)}
            {order.desiredTime && <span className="text-blue-300 ml-2">→ {order.desiredTime}</span>}
          </p>
        </div>
        <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl shrink-0 tabular-nums ${
          minutes >= 10 ? "bg-red-600 text-white" : "bg-orange-600 text-white"
        }`}>⏱{minutes}m</span>
      </div>

      {/* ── PACKAGING ── */}
      {pack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pack.map((p, i) => (
            <span key={i} className="bg-gray-700/80 border border-gray-600/50 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1.5">
              <span>{p.icon}</span>
              <span>{p.count !== undefined && p.count > 1 ? `${p.count}× ` : ""}{p.text}</span>
            </span>
          ))}
          {/* Tagliata toggle — solo asporto/delivery */}
          {isAsportoDelivery && (
            <button
              onClick={onToggleTagliata}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border transition-all ${
                tagliata
                  ? "bg-amber-500 border-amber-400 text-black"
                  : "bg-gray-700/50 border-gray-600/40 text-gray-500 hover:text-gray-300 hover:border-gray-500"
              }`}>
              ✂️ Tagliata
            </button>
          )}
        </div>
      )}

      {/* ── PRODOTTI (lista compatta) ── */}
      <div className="bg-gray-900/60 rounded-xl px-3 py-2.5 space-y-1">
        {order.items.map(item => (
          <div key={item.cartId} className="flex items-center gap-2 text-sm">
            {item.quantity > 1 && <span className="text-orange-400 font-bold shrink-0">×{item.quantity}</span>}
            <span className={item.id === "custom_pizza" ? "text-purple-300 font-semibold" : "text-white font-medium"}>
              {item.name}
            </span>
            {item.size !== "normale" && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                item.size === "maxi" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
              }`}>{item.size.toUpperCase()}</span>
            )}
            {item.isHalf && item.halfPizza1 && item.halfPizza2 && (
              <span className="text-purple-400 text-xs">½+½</span>
            )}
          </div>
        ))}
        {order.extras?.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-blue-300">
            <span className="text-blue-500 shrink-0 text-xs">➕</span>
            <span>{e.description}</span>
          </div>
        ))}
      </div>

      {/* ── CHECKLIST COMPATTA ── */}
      {hasModifications && (
        <div className="space-y-2">
          {Object.entries(grouped).map(([prodName, prodChips]) => (
            <div key={prodName}>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                {prodName}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {prodChips.map(chip => {
                  const done = checked.has(chip.key);
                  return (
                    <button
                      key={chip.key}
                      onClick={() => onToggleCheck(chip.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                        done
                          ? "bg-gray-800/40 border-gray-700/30 text-gray-600 line-through opacity-50"
                          : chipStyle[chip.type]
                      }`}>
                      <span className="font-bold">{done ? "✓" : chipIcon[chip.type]}</span>
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mini progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${chips.length > 0 ? (Array.from(checked).filter(k => chips.some(c => c.key === k)).length / chips.length) * 100 : 100}%` }}
              />
            </div>
            <span className="text-gray-500 text-[10px] tabular-nums">
              {Array.from(checked).filter(k => chips.some(c => c.key === k)).length}/{chips.length}
            </span>
          </div>
        </div>
      )}

      {/* ── NOTE ── */}
      {order.orderNotes && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
          <p className="text-yellow-300 text-sm">📋 {order.orderNotes}</p>
        </div>
      )}

      {/* ── CONSEGNA ── */}
      <button
        onClick={onDeliver}
        disabled={hasModifications && !allDone}
        className={`w-full font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] ${
          !hasModifications || allDone
            ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)]"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}>
        {hasModifications && !allDone
          ? `⏳ Completa modifiche prima`
          : tagliata ? "✂️ Tagliata → 🚀 Consegnato" : "🚀 Consegnato"}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN ZONE
───────────────────────────────────────────────── */
export default function RifinituraZone() {
  const { loading } = useAuth();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [now, setNow]           = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"pronti" | "conclusi">("pronti");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Per ordine: Set di chip già spuntati
  const [checked, setChecked]   = useState<Record<string, Set<string>>>({});
  // Per ordine: tagliata on/off
  const [tagliata, setTagliata] = useState<Record<string, boolean>>({});

  const audioRef   = useRef<AudioContext | null>(null);
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

  const toggleTagliata = (orderId: string) => {
    setTagliata(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const inRifinitura = orders.filter(o => o.status === "pronto");
  const conclusi     = orders.filter(o => o.status === "consegnato");

  const ConclusiList = () => (
    <div className="space-y-2">
      {conclusi.length === 0 && (
        <p className="text-gray-600 text-sm text-center mt-10">Nessun ordine concluso</p>
      )}
      {conclusi.map(order => {
        const isOpen = expanded.has(order.id);
        return (
          <div key={order.id} className="bg-gray-800/80 rounded-2xl border border-gray-700/50 overflow-hidden">
            <button onClick={() => toggleExpanded(order.id)}
              className="w-full p-4 text-left flex items-center justify-between gap-2 active:bg-gray-700/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm font-bold truncate">{orderLabel(order)}</p>
                <div className="flex gap-2 mt-0.5">
                  <p className="text-gray-500 text-xs">{formatTime(order.createdAt)}</p>
                  {order.isPaid && <p className="text-green-500 text-xs font-bold">💳</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-orange-400 text-sm font-bold tabular-nums">€{order.total.toFixed(2)}</span>
                <span className="text-gray-500 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-700/40 p-3 space-y-1.5">
                {order.items.map(item => (
                  <div key={item.cartId} className="text-xs text-gray-400">
                    <span className="text-gray-200 font-medium">
                      {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                      {item.name}
                      {item.size !== "normale" && <span className="text-yellow-500"> [{item.size}]</span>}
                    </span>
                    {item.removedIngredients.length > 0 && <p className="text-red-400 pl-2">✗ {item.removedIngredients.join(", ")}</p>}
                    {item.addedIngredients.length > 0   && <p className="text-green-400 pl-2">+ {item.addedIngredients.map(x => x.name).join(", ")}</p>}
                    {item.notes && <p className="text-yellow-300 pl-2">📝 {item.notes}</p>}
                  </div>
                ))}
                {order.isPaid && (
                  <p className="text-green-400 text-xs font-semibold mt-1">
                    ✅ {order.paymentMethod === "contanti" ? "💵 Contanti" : "💳 Carta"}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const RifinituraList = () => (
    <div className="space-y-4">
      {inRifinitura.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-medium">Nessun ordine da rifinire</p>
        </div>
      )}
      {inRifinitura.map(order => (
        <AssemblyCard
          key={order.id}
          order={order}
          tagliata={tagliata[order.id] ?? false}
          onToggleTagliata={() => toggleTagliata(order.id)}
          checked={checked[order.id] ?? new Set()}
          onToggleCheck={key => toggleCheck(order.id, key)}
          onDeliver={() => updateOrderStatus(order.id, "consegnato")}
        />
      ))}
    </div>
  );

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3 overflow-hidden">

      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white text-xl md:text-2xl font-bold">📦 Rifinitura</h1>
        <div className="flex gap-1.5 text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-bold ${inRifinitura.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"}`}>
            🔧 {inRifinitura.length}
          </span>
          <span className="bg-green-900 text-green-300 px-2.5 py-1 rounded-lg font-bold">✅ {conclusi.length}</span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 shrink-0">
        <button onClick={() => setMobileTab("pronti")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors relative ${mobileTab === "pronti" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
          🔧 Da rifinire
          {inRifinitura.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{inRifinitura.length}</span>
          )}
        </button>
        <button onClick={() => setMobileTab("conclusi")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${mobileTab === "conclusi" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
          ✅ Conclusi ({conclusi.length})
        </button>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileTab === "pronti" ? <RifinituraList /> : <ConclusiList />}
      </div>

      {/* Desktop 2-col */}
      <div className="hidden md:flex gap-4 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-orange-300 font-bold text-sm shrink-0 bg-orange-900/20 border border-orange-700/30 rounded-lg px-3 py-2 mb-3">
            🔧 Da rifinire ({inRifinitura.length})
          </h2>
          <div className="flex-1 overflow-y-auto">
            <RifinituraList />
          </div>
        </div>
        <div className="w-72 flex flex-col overflow-hidden">
          <h2 className="text-green-300 font-bold text-sm shrink-0 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 mb-3">
            ✅ Conclusi ({conclusi.length})
          </h2>
          <div className="flex-1 overflow-y-auto">
            <ConclusiList />
          </div>
        </div>
      </div>
    </div>
  );
}
