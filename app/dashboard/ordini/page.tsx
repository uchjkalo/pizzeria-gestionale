"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { menu, MenuItem, MenuCategory, categoryLabels, DietTag } from "@/lib/menu";
import { createOrder } from "@/lib/orders";
import { OrderItem, OrderType, ExtraItem } from "@/types";
import ItemCustomizeModal from "@/components/zones/ItemCustomizeModal";
import { useRouter } from "next/navigation";

const MODAL_CATEGORIES: MenuCategory[] = ["pizze", "panini", "burger", "specialita"];

const calcTotals = (
  items: OrderItem[], extras: ExtraItem[],
  type: OrderType, peopleCount: number, deliveryCost: number
) => {
  const itemsTotal    = items.reduce((s, i) => s + i.effectivePrice * i.quantity, 0);
  const extrasTotal   = extras.reduce((s, e) => s + e.price, 0);
  const copertoTotal  = type === "tavolo" ? peopleCount : 0;
  const deliveryTotal = type === "delivery" ? deliveryCost : 0;
  return { itemsTotal, extrasTotal, copertoTotal, deliveryTotal,
    grand: itemsTotal + extrasTotal + copertoTotal + deliveryTotal };
};

/* ── SHARED STYLES ── */
const inputCls = "w-full bg-gray-900 text-white rounded-xl px-3 py-3 text-sm outline-none ring-1 ring-gray-700/80 focus:ring-orange-500/60 transition-all placeholder:text-gray-600 mt-1";
const labelCls = "text-gray-500 text-[10px] uppercase tracking-widest font-bold";

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTS — all outside OrdiniPage (avoids remount)
══════════════════════════════════════════════════════════ */

function SearchBar({ value, onChange, mobile }: { value: string; onChange: (v: string) => void; mobile?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none text-sm">🔍</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={mobile ? "Cerca prodotto..." : "Cerca prodotto o ingrediente..."}
        className={`w-full bg-gray-800/70 text-white rounded-2xl pl-10 pr-10 outline-none ring-1 ring-gray-700/60 focus:ring-orange-500/50 transition-all placeholder:text-gray-600 ${mobile ? "py-3.5 text-base" : "py-2.5 text-sm"}`}
      />
      {value && (
        <button onClick={() => onChange("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center">
          ×
        </button>
      )}
    </div>
  );
}

type ActiveCategory = MenuCategory | "glutine";
function CategoryTabs({ active, onSelect, mobile }: { active: ActiveCategory; onSelect: (c: ActiveCategory) => void; mobile?: boolean }) {
  const allTabs: { key: ActiveCategory; label: string }[] = [
    ...( Object.keys(categoryLabels) as MenuCategory[] ).map(k => ({ key: k as ActiveCategory, label: categoryLabels[k] })),
    { key: "glutine", label: "🚫 Glutine" },
  ];
  return (
    <div className={`flex gap-1.5 ${mobile ? "overflow-x-auto scrollbar-hide" : "flex-wrap"}`}>
      {allTabs.map(({ key, label }) => (
        <button key={key} onClick={() => onSelect(key)}
          className={`whitespace-nowrap font-bold transition-all shrink-0 ${mobile ? "px-4 py-2.5 rounded-xl text-sm" : "px-3 py-1.5 rounded-xl text-sm"} ${
            active === key
              ? key === "glutine"
                ? "bg-red-600/80 text-white shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
                : "bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)]"
              : "bg-gray-800/60 text-gray-500 border border-gray-700/40 hover:text-gray-200"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

type DietOrBianca = DietTag | "tutti" | "bianca";
function DietTabs({ active, onSelect }: { active: DietOrBianca; onSelect: (f: DietOrBianca) => void }) {
  const opts: { k: DietOrBianca; l: string }[] = [
    { k: "tutti",       l: "Tutti" },
    { k: "normale",     l: "🍽 Normale" },
    { k: "vegetariano", l: "🌿 Veg" },
    { k: "vegano",      l: "🥦 Vegano" },
    { k: "bianca",      l: "🤍 Bianca" },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {opts.map(({ k, l }) => (
        <button key={k} onClick={() => onSelect(k)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border shrink-0 transition-all ${
            active === k ? "border-orange-500/40 bg-orange-500/10 text-orange-300" : "border-gray-700/40 text-gray-600"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function EmptyGrid({ onClear, hasSearch }: { onClear?: () => void; hasSearch?: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-700">
      <span className="text-4xl mb-3 opacity-40">🔍</span>
      <p className="text-sm font-medium text-gray-600">Nessun prodotto trovato</p>
      {hasSearch && onClear && (
        <button onClick={onClear} className="mt-3 text-sm text-orange-500 hover:text-orange-400">
          Cancella ricerca
        </button>
      )}
    </div>
  );
}

interface MenuCardProps {
  item: MenuItem; totalQty: number; directQty: number;
  onPrimary: () => void; onDirectAdd: () => void; onDirectRemove: () => void;
  glutenFreeMode?: boolean;
}
function MenuCard({ item, totalQty, directQty, onPrimary, onDirectAdd, onDirectRemove, glutenFreeMode }: MenuCardProps) {
  const isDirect = !MODAL_CATEGORIES.includes(item.category as MenuCategory);
  const isCustom = item.id === "custom_pizza";
  const inCart   = totalQty > 0;
  return (
    <div className="relative">
      <button onClick={onPrimary}
        className={`w-full border rounded-2xl p-3 text-left transition-all duration-150 group ${
          isCustom
            ? inCart ? "bg-purple-950/50 border-purple-500/60" : "bg-purple-950/20 border-purple-800/30 hover:border-purple-600/50"
            : inCart ? "bg-[#1a1200] border-orange-500/50 shadow-[0_0_16px_rgba(249,115,22,0.08)]"
                     : "bg-gray-800/50 border-gray-700/30 hover:border-gray-600/50"
        }`}>
        {inCart && (
          <span className={`absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full text-[11px] font-black text-white flex items-center justify-center shadow-lg ${isCustom ? "bg-purple-500" : "bg-orange-500"}`}>
            {totalQty}
          </span>
        )}
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className={`font-bold text-sm leading-tight flex-1 ${isCustom ? "text-purple-300" : "text-white"}`}>{item.name}</p>
          <div className="flex items-center gap-1 shrink-0">
          {item.tag === "vegetariano" && <span className="text-[10px]">🌿</span>}
          {item.tag === "vegano" && <span className="text-[10px]">🥦</span>}
          {item.glutenFree && !glutenFreeMode && <span className="text-[9px] text-red-400/70 font-bold">GF</span>}
        </div>
        </div>
        {item.note && <span className="inline-block text-[9px] uppercase tracking-wider text-gray-600 font-bold mb-1.5 bg-gray-700/40 px-1.5 py-0.5 rounded-full">{item.note}</span>}
        {item.ingredients.length > 0 && !isCustom && (
          <p className="hidden xl:block text-[10px] text-gray-600 mb-1.5 line-clamp-2">{item.ingredients.join(", ")}</p>
        )}
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`font-black text-base tabular-nums ${isCustom ? "text-purple-400" : "text-orange-400"}`}>€{item.price.toFixed(2)}</span>
          {item.maxiPrice && <span className="text-[9px] text-amber-600/80 font-bold">MAXI €{item.maxiPrice}</span>}
        </div>
        {!isDirect && <p className={`text-[10px] mt-1 ${isCustom ? "text-purple-800" : "text-gray-700"}`}>✏️ personalizza</p>}
        {isDirect && directQty > 0 && <div className="h-9 mt-1" />}
      </button>
      {isDirect && directQty > 0 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={onDirectRemove} className="w-8 h-8 bg-gray-700 hover:bg-red-600/50 text-white rounded-lg font-bold flex items-center justify-center transition-all active:scale-90">−</button>
          <span className="text-white font-bold text-sm w-5 text-center tabular-nums">{directQty}</span>
          <button onClick={onDirectAdd} className="w-8 h-8 bg-gray-700 hover:bg-green-600/50 text-white rounded-lg font-bold flex items-center justify-center transition-all active:scale-90">+</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ORDER PANEL — split into Body + Footer for mobile sticky
══════════════════════════════════════════════════════════ */
interface OrderPanelProps {
  cartItems: OrderItem[]; extras: ExtraItem[]; orderType: OrderType;
  tableNumber: number; peopleCount: number; customerName: string;
  deliveryAddress: string; deliveryCost: number; desiredTime: string;
  isUrgent: boolean; orderNotes: string; newExtraDesc: string; newExtraPrice: string;
  saving: boolean; success: boolean; submitError: string | null;
  onOrderTypeChange: (t: OrderType) => void; onTableNumberChange: (n: number) => void;
  onPeopleCountChange: (n: number) => void; onCustomerNameChange: (s: string) => void;
  onDeliveryAddressChange: (s: string) => void; onDeliveryCostChange: (n: number) => void;
  onDesiredTimeChange: (s: string) => void; onIsUrgentChange: (b: boolean) => void;
  onOrderNotesChange: (s: string) => void; onNewExtraDescChange: (s: string) => void;
  onNewExtraPriceChange: (s: string) => void; onAddExtra: () => void;
  onRemoveExtra: (i: number) => void; onRemoveCartItem: (cartId: string) => void;
  onEditCartItem: (menuItem: MenuItem, cartId: string) => void;
  onClearCart: () => void; onSubmit: () => void; onGoToCassa: () => void;
  menuById: (id: string) => MenuItem | undefined;
}

/** Tutto tranne i bottoni finali — usato nel body scrollabile */
function OrderPanelBody(p: OrderPanelProps) {
  const totalItems = p.cartItems.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="p-3 space-y-3">
      {/* Tipo ordine */}
      <div className="grid grid-cols-3 gap-1 bg-gray-900/60 p-1 rounded-2xl">
        {(["tavolo", "asporto", "delivery"] as OrderType[]).map(t => {
          const active = p.orderType === t;
          const cfg = { tavolo: { e: "🪑", l: "Tavolo" }, asporto: { e: "🥡", l: "Asporto" }, delivery: { e: "🚴", l: "Delivery" } }[t];
          return (
            <button key={t} onClick={() => p.onOrderTypeChange(t)}
              className={`py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${active ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25" : "text-gray-500"}`}>
              <span className="text-lg">{cfg.e}</span>{cfg.l}
            </button>
          );
        })}
      </div>

      {p.orderType === "tavolo" && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Tavolo</label><input type="number" min={1} value={p.tableNumber} onChange={e => p.onTableNumberChange(+e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Persone (+€1)</label><input type="number" min={1} value={p.peopleCount} onChange={e => p.onPeopleCountChange(+e.target.value)} className={inputCls} /></div>
        </div>
      )}
      {(p.orderType === "asporto" || p.orderType === "delivery") && (
        <div><label className={labelCls}>Nome cliente</label><input type="text" value={p.customerName} onChange={e => p.onCustomerNameChange(e.target.value)} placeholder="Mario Rossi" className={inputCls} /></div>
      )}
      {p.orderType === "delivery" && (
        <div className="space-y-2">
          <div><label className={labelCls}>Indirizzo</label><input type="text" value={p.deliveryAddress} onChange={e => p.onDeliveryAddressChange(e.target.value)} placeholder="Via Roma 1" className={inputCls} /></div>
          <div><label className={labelCls}>Costo delivery €</label><input type="number" min={0} step={0.5} value={p.deliveryCost} onChange={e => p.onDeliveryCostChange(+e.target.value)} className={inputCls} /></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls}>Orario</label><input type="time" value={p.desiredTime} onChange={e => p.onDesiredTimeChange(e.target.value)} className={inputCls} /></div>
        <div className="flex flex-col justify-end">
          <button onClick={() => p.onIsUrgentChange(!p.isUrgent)}
            className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${p.isUrgent ? "border-red-500 bg-red-500/10 text-red-400" : "border-gray-700 text-gray-600"}`}>
            🔴 URGENTE
          </button>
        </div>
      </div>

      {/* Carrello */}
      {p.cartItems.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-gray-700">
          <div className="text-4xl mb-2 opacity-30">🛒</div>
          <p className="text-sm text-gray-600">Carrello vuoto</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={labelCls}>{totalItems} {totalItems === 1 ? "prodotto" : "prodotti"}</p>
          {p.cartItems.map(ci => {
            const menuItem = p.menuById(ci.id);
            const isDirect = ci.cartId.includes("_direct");
            const isCustom = ci.id === "custom_pizza";
            return (
              <div key={ci.cartId} className={`rounded-2xl p-2.5 border ${isCustom ? "bg-purple-950/40 border-purple-700/30" : "bg-gray-900/60 border-gray-700/30"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-bold ${isCustom ? "text-purple-300" : "text-white"}`}>{ci.name}</p>
                      {ci.size !== "normale" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${ci.size === "maxi" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>{ci.size.toUpperCase()}</span>
                      )}
                    </div>
                    {ci.isHalf && ci.halfPizza1 && ci.halfPizza2 && <p className="text-purple-400 text-[10px]">½ {ci.halfPizza1.name} + ½ {ci.halfPizza2.name}</p>}
                    {ci.removedIngredients.length > 0 && <p className="text-red-400 text-[10px]">✗ {ci.removedIngredients.join(", ")}</p>}
                    {ci.addedIngredients.length > 0 && <p className="text-green-400 text-[10px]">+ {ci.addedIngredients.map(i => i.name).join(", ")}</p>}
                    {ci.manualAdditions?.length > 0 && <p className="text-orange-300 text-[10px]">✏️ {ci.manualAdditions.map(m => m.name).join(", ")}</p>}
                    {ci.notes && <p className="text-gray-600 text-[10px] italic">"{ci.notes}"</p>}
                    <p className="text-orange-400 text-[10px] font-semibold mt-0.5">
                      €{ci.effectivePrice.toFixed(2)} × {ci.quantity} = <span className="font-black">€{(ci.effectivePrice * ci.quantity).toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isDirect && menuItem && (
                      <button onClick={() => p.onEditCartItem(menuItem, ci.cartId)} className="w-9 h-9 bg-gray-800 hover:bg-blue-600/30 text-gray-500 hover:text-blue-400 rounded-xl flex items-center justify-center transition-all">✏️</button>
                    )}
                    <button onClick={() => p.onRemoveCartItem(ci.cartId)} className="w-9 h-9 bg-gray-800 hover:bg-red-600/30 text-gray-500 hover:text-red-400 rounded-xl font-bold text-lg flex items-center justify-center transition-all">×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra manuali */}
      <div>
        <p className={`${labelCls} mb-2`}>Extra ordine</p>
        <div className="flex gap-1.5 min-w-0">
          <input value={p.newExtraDesc} onChange={e => p.onNewExtraDescChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && p.onAddExtra()} placeholder="Descrizione"
            className="min-w-0 flex-1 bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-gray-700/60 focus:ring-orange-500/50 placeholder:text-gray-700" />
          <input value={p.newExtraPrice} onChange={e => p.onNewExtraPriceChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && p.onAddExtra()} placeholder="€" type="number" step={0.5}
            className="w-11 shrink-0 bg-gray-900 text-white rounded-xl px-1 py-2.5 text-sm text-center outline-none ring-1 ring-gray-700/60" />
          <button onClick={p.onAddExtra}
            className="shrink-0 w-10 h-10 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white rounded-xl font-bold text-xl flex items-center justify-center transition-colors">
            +
          </button>
        </div>
        {p.extras.map((e, i) => (
          <div key={i} className="flex justify-between items-center mt-1.5 bg-gray-900/60 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-400 text-xs">{e.description}</span>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-xs font-bold">€{e.price.toFixed(2)}</span>
              <button onClick={() => p.onRemoveExtra(i)} className="text-gray-600 hover:text-red-400 text-lg leading-none w-6 h-6 flex items-center justify-center">×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <textarea value={p.orderNotes} onChange={e => p.onOrderNotesChange(e.target.value)}
        placeholder="📋 Note per la cucina..." rows={2}
        className="w-full bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-gray-700/60 resize-none placeholder:text-gray-700" />
    </div>
  );
}

/** Solo totale + bottoni — sticky in fondo al sheet mobile */
function OrderPanelFooter(p: OrderPanelProps) {
  const totals = calcTotals(p.cartItems, p.extras, p.orderType, p.peopleCount, p.deliveryCost);
  return (
    <div className="border-t border-gray-700/50 bg-gray-900 p-3 space-y-2">
      {/* Breakdown totale */}
      <div className="space-y-0.5">
        {totals.copertoTotal > 0 && <div className="flex justify-between text-xs text-gray-600"><span>Coperto ({p.peopleCount} pers.)</span><span>€{totals.copertoTotal.toFixed(2)}</span></div>}
        {totals.deliveryTotal > 0 && <div className="flex justify-between text-xs text-gray-600"><span>Delivery</span><span>€{totals.deliveryTotal.toFixed(2)}</span></div>}
        {totals.extrasTotal > 0 && <div className="flex justify-between text-xs text-gray-600"><span>Extra</span><span>€{totals.extrasTotal.toFixed(2)}</span></div>}
        <div className="flex justify-between items-baseline pt-1 border-t border-gray-700/40">
          <span className="text-gray-400 text-sm font-semibold">Totale</span>
          <span className="text-orange-400 font-black text-2xl tabular-nums">€{totals.grand.toFixed(2)}</span>
        </div>
      </div>
      {/* Feedback */}
      {p.success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl py-2 text-center">
          <p className="text-green-400 text-sm font-bold">✅ Ordine inviato!</p>
        </div>
      )}
      {p.submitError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <p className="text-red-400 text-xs font-bold">❌ Errore: {p.submitError}</p>
        </div>
      )}
      {/* Invia */}
      <button onClick={p.onSubmit} disabled={p.cartItems.length === 0 || p.saving}
        className={`w-full font-bold py-4 rounded-2xl text-sm transition-all active:scale-[0.98] ${
          p.cartItems.length > 0 && !p.saving
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
            : "bg-gray-800 text-gray-600 cursor-not-allowed"
        }`}>
        {p.saving ? "⏳ Invio..." : `✅ Invia ordine · €${totals.grand.toFixed(2)}`}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={p.onGoToCassa} className="bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-300 text-xs py-3 rounded-2xl font-semibold transition-all">💳 Cassa</button>
        <button onClick={p.onClearCart} disabled={p.cartItems.length === 0}
          className="bg-gray-800 hover:bg-red-900/20 hover:border-red-700/30 border border-gray-700/50 disabled:opacity-25 text-gray-500 hover:text-red-400 text-xs py-3 rounded-2xl font-semibold disabled:cursor-not-allowed transition-all">
          🗑 Svuota
        </button>
      </div>
    </div>
  );
}

/** Versione desktop: tutto in un pannello scorrevole fisso */
function OrderPanelDesktop(p: OrderPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <OrderPanelBody {...p} />
      </div>
      <OrderPanelFooter {...p} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   GLUTINE VIEW — griglia raggruppata per categoria
══════════════════════════════════════════════════════════ */
interface GlutineViewProps {
  groups: { cat: MenuCategory; label: string; items: MenuItem[] }[];
  cartItems: OrderItem[];
  onPrimary: (item: MenuItem) => void;
  onDirectAdd: (item: MenuItem) => void;
  onDirectRemove: (item: MenuItem) => void;
}
function GlutineView({ groups, cartItems, onPrimary, onDirectAdd, onDirectRemove }: GlutineViewProps) {
  if (groups.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-700">
      <span className="text-4xl mb-3 opacity-40">🚫</span>
      <p className="text-sm text-gray-600">Nessun prodotto senza glutine</p>
    </div>
  );
  return (
    <div className="space-y-5">
      {groups.map(({ cat, label, items }) => (
        <div key={cat}>
          {/* Intestazione sezione */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-xl px-3 py-1.5">
              <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">🚫 gluten free</span>
              <span className="text-white text-sm font-bold">{label}</span>
            </div>
            <div className="flex-1 h-px bg-gray-700/40" />
            <span className="text-gray-600 text-xs">{items.length}</span>
          </div>
          {/* Griglia prodotti per questa categoria */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {items.map(item => {
              const isDirect  = !MODAL_CATEGORIES.includes(item.category as MenuCategory);
              const directQty = cartItems.find(i => i.cartId === `${item.id}_direct`)?.quantity ?? 0;
              const modalQty  = cartItems.filter(i => i.id === item.id && !i.cartId.includes("direct")).reduce((s, i) => s + i.quantity, 0);
              return (
                <MenuCard key={item.id} item={item}
                  totalQty={directQty + modalQty} directQty={directQty}
                  onPrimary={() => onPrimary(item)}
                  onDirectAdd={() => onDirectAdd(item)}
                  onDirectRemove={() => onDirectRemove(item)}
                  glutenFreeMode
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrdiniPage() {
  const { loading } = useAuth();
  const router = useRouter();

  /* ── ALL HOOKS FIRST ── */
  const [cartItems, setCartItems]             = useState<OrderItem[]>([]);
  const [extras, setExtras]                   = useState<ExtraItem[]>([]);
  const [newExtraDesc, setNewExtraDesc]       = useState("");
  const [newExtraPrice, setNewExtraPrice]     = useState("");
  const [orderType, setOrderType]             = useState<OrderType>("asporto");
  const [tableNumber, setTableNumber]         = useState(1);
  const [peopleCount, setPeopleCount]         = useState(2);
  const [customerName, setCustomerName]       = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCost, setDeliveryCost]       = useState(2);
  const [desiredTime, setDesiredTime]         = useState("");
  const [isUrgent, setIsUrgent]               = useState(false);
  const [orderNotes, setOrderNotes]           = useState("");
  const [modalItem, setModalItem]             = useState<MenuItem | null>(null);
  const [editingCartId, setEditingCartId]     = useState<string | null>(null);
  const [activeCategory, setActiveCategory]   = useState<MenuCategory | "glutine">("pizze");
  const [dietFilter, setDietFilter]           = useState<DietOrBianca>("tutti");
  const [searchQuery, setSearchQuery]         = useState("");
  const [saving, setSaving]                   = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [submitError, setSubmitError]         = useState<string | null>(null);
  const [cartOpen, setCartOpen]               = useState(false);

  /* BUG FIX: useMemo BEFORE any conditional return */
  const displayedItems = useMemo(() => {
    if (activeCategory === "glutine" && !searchQuery.trim()) return []; // handled separately
    const items = searchQuery.trim()
      ? menu.filter(m =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : menu.filter(m =>
          m.category === (activeCategory as MenuCategory) &&
          (dietFilter === "tutti" ||
           (dietFilter === "bianca" ? m.note?.toLowerCase().includes("bianca") : m.tag === (dietFilter as DietTag)))
        );
    return [
      ...items.filter(i => i.id !== "custom_pizza").sort((a, b) => a.name.localeCompare(b.name, "it")),
      ...items.filter(i => i.id === "custom_pizza"),
    ];
  }, [searchQuery, activeCategory, dietFilter]);

  // Grouped gluten-free items — only used when activeCategory === "glutine"
  const glutineGroups = useMemo(() => {
    if (activeCategory !== "glutine" || searchQuery.trim()) return null;
    const gfItems = menu.filter(m => m.glutenFree === true);
    const groups: { cat: MenuCategory; label: string; items: typeof menu }[] = [];
    (Object.keys(categoryLabels) as MenuCategory[]).forEach(cat => {
      const catItems = gfItems
        .filter(m => m.category === cat && m.id !== "custom_pizza")
        .sort((a, b) => a.name.localeCompare(b.name, "it"));
      if (catItems.length > 0) groups.push({ cat, label: categoryLabels[cat], items: catItems });
    });
    return groups;
  }, [activeCategory, searchQuery]);

  /* ── CONDITIONAL RETURN after all hooks ── */
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="relative w-14 h-14 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🍕</div>
        </div>
        <p className="text-gray-600 text-sm">Caricamento...</p>
      </div>
    </div>
  );

  const menuById   = (id: string) => menu.find(m => m.id === id);
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totals     = calcTotals(cartItems, extras, orderType, peopleCount, deliveryCost);

  const openModal = (item: MenuItem, cartId?: string) => { setModalItem(item); setEditingCartId(cartId ?? null); };
  const handleModalConfirm = (cartItem: OrderItem) => {
    if (editingCartId) setCartItems(prev => prev.map(i => i.cartId === editingCartId ? cartItem : i));
    else setCartItems(prev => [...prev, cartItem]);
    setModalItem(null); setEditingCartId(null);
  };

  const directAdd = (item: MenuItem) => {
    setCartItems(prev => {
      const key = `${item.id}_direct`;
      const ex  = prev.find(i => i.cartId === key);
      if (ex) return prev.map(i => i.cartId === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartId: key, id: item.id, name: item.name, category: item.category,
        size: "normale", basePrice: item.price, effectivePrice: item.price,
        quantity: 1, removedIngredients: [], addedIngredients: [], manualAdditions: [], notes: "" }];
    });
  };
  const directRemove = (item: MenuItem) => {
    const key = `${item.id}_direct`;
    setCartItems(prev => {
      const ex = prev.find(i => i.cartId === key);
      if (!ex) return prev;
      if (ex.quantity > 1) return prev.map(i => i.cartId === key ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.cartId !== key);
    });
  };
  const removeCartItem = (cartId: string) => setCartItems(prev => prev.filter(i => i.cartId !== cartId));
  const clearCart = () => { setCartItems([]); setExtras([]); };
  const addExtra = () => {
    if (!newExtraDesc.trim() || !newExtraPrice) return;
    setExtras(prev => [...prev, { description: newExtraDesc, price: parseFloat(newExtraPrice) }]);
    setNewExtraDesc(""); setNewExtraPrice("");
  };

  const submitOrder = async () => {
    if (cartItems.length === 0) return;
    setSaving(true); setSubmitError(null);
    try {
      await createOrder({ type: orderType, status: "attesa", items: cartItems, extras,
        tableNumber:     orderType === "tavolo"   ? tableNumber    : undefined,
        peopleCount:     orderType === "tavolo"   ? peopleCount    : undefined,
        customerName:    orderType !== "tavolo"   ? customerName   : undefined,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        deliveryCost:    orderType === "delivery" ? deliveryCost   : undefined,
        desiredTime:     desiredTime || undefined, isUrgent,
        orderNotes:      orderNotes || undefined, total: totals.grand,
      });
      clearCart();
      setCustomerName(""); setDeliveryAddress(""); setDesiredTime("");
      setPeopleCount(2); setTableNumber(1); setIsUrgent(false); setOrderNotes("");
      setSuccess(true); setCartOpen(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Errore sconosciuto");
      console.error("[submitOrder]", err);
    } finally { setSaving(false); }
  };

  const panelProps: OrderPanelProps = {
    cartItems, extras, orderType, tableNumber, peopleCount, customerName,
    deliveryAddress, deliveryCost, desiredTime, isUrgent, orderNotes,
    newExtraDesc, newExtraPrice, saving, success, submitError,
    onOrderTypeChange:       setOrderType,
    onTableNumberChange:     setTableNumber,
    onPeopleCountChange:     setPeopleCount,
    onCustomerNameChange:    setCustomerName,
    onDeliveryAddressChange: setDeliveryAddress,
    onDeliveryCostChange:    setDeliveryCost,
    onDesiredTimeChange:     setDesiredTime,
    onIsUrgentChange:        setIsUrgent,
    onOrderNotesChange:      setOrderNotes,
    onNewExtraDescChange:    setNewExtraDesc,
    onNewExtraPriceChange:   setNewExtraPrice,
    onAddExtra:              addExtra,
    onRemoveExtra:           i => setExtras(prev => prev.filter((_, idx) => idx !== i)),
    onRemoveCartItem:        removeCartItem,
    onEditCartItem:          (mi, cid) => openModal(mi, cid),
    onClearCart:             clearCart,
    onSubmit:                submitOrder,
    onGoToCassa:             () => router.push("/dashboard/cassa"),
    menuById,
  };

  /* ── PRODUCT GRID (shared) ── */
  const renderMenuCard = (item: MenuItem) => {
    const isDirect  = !MODAL_CATEGORIES.includes(item.category as MenuCategory);
    const directQty = cartItems.find(i => i.cartId === `${item.id}_direct`)?.quantity ?? 0;
    const modalQty  = cartItems.filter(i => i.id === item.id && !i.cartId.includes("direct")).reduce((s, i) => s + i.quantity, 0);
    return <MenuCard key={item.id} item={item} totalQty={directQty + modalQty} directQty={directQty}
      onPrimary={() => isDirect ? directAdd(item) : openModal(item)}
      onDirectAdd={() => directAdd(item)} onDirectRemove={() => directRemove(item)} />;
  };

  const renderGrid = () => {
    // Glutine view: grouped by category
    if (activeCategory === "glutine" && !searchQuery.trim() && glutineGroups) {
      return (
        <GlutineView
          groups={glutineGroups} cartItems={cartItems}
          onPrimary={item => !MODAL_CATEGORIES.includes(item.category) ? directAdd(item) : openModal(item)}
          onDirectAdd={directAdd} onDirectRemove={directRemove}
        />
      );
    }
    if (displayedItems.length === 0) return <EmptyGrid hasSearch={!!searchQuery} onClear={() => setSearchQuery("")} />;
    return displayedItems.map(renderMenuCard);
  };

  // In glutine mode the outer grid wrapper should be a div, not CSS grid
  const isGlutineView = activeCategory === "glutine" && !searchQuery.trim();

  /* ── RENDER ── */
  return (
    <>
      {modalItem && (
        <ItemCustomizeModal item={modalItem}
          existingCartItem={editingCartId ? cartItems.find(i => i.cartId === editingCartId) : undefined}
          onConfirm={handleModalConfirm}
          onClose={() => { setModalItem(null); setEditingCartId(null); }} />
      )}

      {/* ══════════ DESKTOP md+ ══════════ */}
      <div className="hidden md:flex gap-4 h-[calc(100vh-80px)]">
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 overflow-hidden">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          {!searchQuery ? (
            <div className="flex flex-col gap-2 shrink-0">
              <CategoryTabs active={activeCategory} onSelect={setActiveCategory} />
              {activeCategory !== "glutine" && <DietTabs active={dietFilter} onSelect={setDietFilter} />}
            </div>
          ) : (
            <p className="text-gray-600 text-xs shrink-0">{displayedItems.length} risultati per <span className="text-orange-400">"{searchQuery}"</span></p>
          )}
          <div className={`overflow-y-auto pb-2 ${isGlutineView ? "" : "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 content-start"}`}>
            {renderGrid()}
          </div>
        </div>
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden bg-gray-800/40 border border-gray-700/30 rounded-2xl">
          <div className="px-4 py-3 border-b border-gray-700/40 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">🧾 Ordine</span>
              {totalItems > 0 && <span className="bg-orange-500 text-white text-[10px] rounded-full px-2 py-0.5 font-black">{totalItems}</span>}
            </div>
            <div className="flex items-center gap-2">
              {isUrgent && <span className="text-red-400 text-[10px] font-bold animate-pulse">🔴</span>}
              {totals.grand > 0 && <span className="text-orange-400 text-sm font-black">€{totals.grand.toFixed(2)}</span>}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <OrderPanelDesktop {...panelProps} />
          </div>
        </div>
      </div>

      {/* ══════════ MOBILE < md ══════════ */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        <div className="shrink-0 space-y-2 mb-2">
          <SearchBar value={searchQuery} onChange={setSearchQuery} mobile />
          {!searchQuery ? (
            <>
              <CategoryTabs active={activeCategory} onSelect={setActiveCategory} mobile />
              {activeCategory !== "glutine" && <DietTabs active={dietFilter} onSelect={setDietFilter} />}
            </>
          ) : (
            <p className="text-gray-600 text-xs">{displayedItems.length} risultati per <span className="text-orange-400">"{searchQuery}"</span></p>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto pb-2 ${isGlutineView ? "" : "grid grid-cols-2 gap-2 content-start"}`}>
          {renderGrid()}
        </div>

        {/* FAB carrello */}
        {totalItems > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)}
            className="fixed bottom-[76px] right-4 z-30 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl pl-4 pr-5 py-3.5 shadow-[0_8px_32px_rgba(249,115,22,0.45)] flex items-center gap-2.5 font-bold text-sm active:scale-95 transition-transform">
            <span className="text-lg">🛒</span>
            <span>{totalItems} {totalItems === 1 ? "prodotto" : "prodotti"}</span>
            <span className="bg-black/20 rounded-lg px-2 py-0.5 text-xs font-black tabular-nums">€{totals.grand.toFixed(2)}</span>
          </button>
        )}

        {/* ── BOTTOM SHEET ──
            Struttura:
            [drag handle]
            [header con ×]          ← NON scrollabile
            [body OrderPanelBody]   ← SCROLLABILE
            [footer OrderPanelFooter] ← FISSO in fondo
        */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/70" style={{ backdropFilter: "blur(4px)" }} onClick={() => setCartOpen(false)} />
            <div className="relative bg-gray-900 rounded-t-3xl flex flex-col z-10 border-t border-gray-700/30"
              style={{ maxHeight: "calc(100svh - 64px)" }}>

              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-700 rounded-full" />
              </div>

              {/* Header — X in basso a destra del header, NON vicino alla barra URL */}
              <div className="flex items-center justify-between px-4 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-base">🧾 Ordine</span>
                  {totalItems > 0 && <span className="bg-orange-500 text-white text-xs rounded-full px-2.5 py-0.5 font-black">{totalItems}</span>}
                  {isUrgent && <span className="text-red-400 text-xs font-bold animate-pulse">🔴 URGENTE</span>}
                </div>
                {/* X button grande, facilmente cliccabile */}
                <button onClick={() => setCartOpen(false)}
                  className="w-11 h-11 bg-gray-800 active:bg-gray-700 text-gray-400 active:text-white rounded-2xl flex items-center justify-center text-2xl font-bold transition-all">
                  ×
                </button>
              </div>

              {/* BODY — scrollabile */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <OrderPanelBody {...panelProps} />
              </div>

              {/* FOOTER — sticky, non scrolla */}
              <OrderPanelFooter {...panelProps} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
