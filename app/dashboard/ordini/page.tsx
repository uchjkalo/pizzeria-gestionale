“use client”;

import { useState, useMemo } from “react”;
import { useAuth } from “@/hooks/useAuth”;
import { menu, MenuItem, MenuCategory, categoryLabels, tagColors, DietTag } from “@/lib/menu”;
import { createOrder } from “@/lib/orders”;
import { OrderItem, OrderType, ExtraItem } from “@/types”;
import ItemCustomizeModal from “@/components/zones/ItemCustomizeModal”;
import { useRouter } from “next/navigation”;

const MODAL_CATEGORIES: MenuCategory[] = [“pizze”, “panini”, “burger”, “specialita”];

const calcTotals = (
items: OrderItem[],
extras: ExtraItem[],
type: OrderType,
peopleCount: number,
deliveryCost: number
) => {
const itemsTotal    = items.reduce((s, i) => s + i.effectivePrice * i.quantity, 0);
const extrasTotal   = extras.reduce((s, e) => s + e.price, 0);
const copertoTotal  = type === “tavolo” ? peopleCount : 0;
const deliveryTotal = type === “delivery” ? deliveryCost : 0;
return {
itemsTotal,
extrasTotal,
copertoTotal,
deliveryTotal,
grand: itemsTotal + extrasTotal + copertoTotal + deliveryTotal,
};
};

// ─────────────────────────────────────────────────────────
// PANNELLO ORDINE (riutilizzato su desktop e mobile sheet)
// ─────────────────────────────────────────────────────────
interface OrderPanelProps {
cartItems: OrderItem[];
extras: ExtraItem[];
orderType: OrderType;
tableNumber: number;
peopleCount: number;
customerName: string;
deliveryAddress: string;
deliveryCost: number;
desiredTime: string;
isUrgent: boolean;
orderNotes: string;
newExtraDesc: string;
newExtraPrice: string;
saving: boolean;
success: boolean;
onOrderTypeChange: (t: OrderType) => void;
onTableNumberChange: (n: number) => void;
onPeopleCountChange: (n: number) => void;
onCustomerNameChange: (s: string) => void;
onDeliveryAddressChange: (s: string) => void;
onDeliveryCostChange: (n: number) => void;
onDesiredTimeChange: (s: string) => void;
onIsUrgentChange: (b: boolean) => void;
onOrderNotesChange: (s: string) => void;
onNewExtraDescChange: (s: string) => void;
onNewExtraPriceChange: (s: string) => void;
onAddExtra: () => void;
onRemoveExtra: (i: number) => void;
onRemoveCartItem: (cartId: string) => void;
onEditCartItem: (menuItem: MenuItem, cartId: string) => void;
onClearCart: () => void;
onSubmit: () => void;
onGoToCassa: () => void;
menuById: (id: string) => MenuItem | undefined;
}

function OrderPanel(p: OrderPanelProps) {
const totals   = calcTotals(p.cartItems, p.extras, p.orderType, p.peopleCount, p.deliveryCost);
const totalItems = p.cartItems.reduce((s, i) => s + i.quantity, 0);

return (
<div className="flex flex-col h-full">

  {/* Tipo ordine */}
  <div className="p-3 border-b border-gray-700 shrink-0 space-y-2">
    <div className="grid grid-cols-3 gap-1">
      {(["tavolo", "asporto", "delivery"] as OrderType[]).map(t => (
        <button key={t} onClick={() => p.onOrderTypeChange(t)}
          className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
            p.orderType === t ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"
          }`}>
          {t === "tavolo" ? "🪑 Tavolo" : t === "asporto" ? "🥡 Asporto" : "🚴 Delivery"}
        </button>
      ))}
    </div>

    {p.orderType === "tavolo" && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 text-xs">N° Tavolo</label>
          <input type="number" min={1} value={p.tableNumber}
            onChange={e => p.onTableNumberChange(+e.target.value)}
            className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="text-gray-400 text-xs">Persone (+€1)</label>
          <input type="number" min={1} value={p.peopleCount}
            onChange={e => p.onPeopleCountChange(+e.target.value)}
            className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>
    )}

    {(p.orderType === "asporto" || p.orderType === "delivery") && (
      <div>
        <label className="text-gray-400 text-xs">Nome cliente</label>
        <input type="text" value={p.customerName}
          onChange={e => p.onCustomerNameChange(e.target.value)}
          placeholder="Es. Mario Rossi"
          className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
      </div>
    )}

    {p.orderType === "delivery" && (
      <div className="space-y-2">
        <div>
          <label className="text-gray-400 text-xs">Indirizzo</label>
          <input type="text" value={p.deliveryAddress}
            onChange={e => p.onDeliveryAddressChange(e.target.value)}
            placeholder="Via Roma 1, Barcis"
            className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="text-gray-400 text-xs">Costo delivery (€)</label>
          <input type="number" min={0} step={0.5} value={p.deliveryCost}
            onChange={e => p.onDeliveryCostChange(+e.target.value)}
            className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>
    )}

    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-gray-400 text-xs">Orario desiderato</label>
        <input type="time" value={p.desiredTime}
          onChange={e => p.onDesiredTimeChange(e.target.value)}
          className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-orange-500" />
      </div>
      <div className="flex flex-col justify-end">
        <button onClick={() => p.onIsUrgentChange(!p.isUrgent)}
          className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
            p.isUrgent
              ? "border-red-500 bg-red-500/20 text-red-300"
              : "border-gray-600 bg-gray-700 text-gray-400"
          }`}>
          🔴 Urgente
        </button>
      </div>
    </div>
  </div>

  {/* Carrello */}
  <div className="flex-1 overflow-y-auto p-3 space-y-2">
    {p.cartItems.length === 0 && (
      <div className="text-center text-gray-500 mt-8">
        <p className="text-4xl mb-2">🛒</p>
        <p className="text-sm">Nessun prodotto</p>
      </div>
    )}
    {p.cartItems.map(ci => {
      const menuItem = p.menuById(ci.id);
      const isDirect = ci.cartId.includes("_direct");
      const isCustom = ci.id === "custom_pizza";
      return (
        <div key={ci.cartId}
          className={`rounded-2xl p-3 border ${
            isCustom ? "bg-purple-900/20 border-purple-700/50" : "bg-gray-700/60 border-gray-600"
          }`}>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={`text-sm font-bold ${isCustom ? "text-purple-300" : "text-white"}`}>
                  {ci.name}
                </p>
                {isCustom && (
                  <span className="text-xs bg-purple-600/30 text-purple-400 px-1.5 py-0.5 rounded font-bold">🎨</span>
                )}
                {ci.size !== "normale" && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                    ci.size === "maxi" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                  }`}>{ci.size.toUpperCase()}</span>
                )}
              </div>
              {ci.isHalf && ci.halfPizza1 && ci.halfPizza2 && (
                <p className="text-purple-400 text-xs mt-0.5">½ {ci.halfPizza1.name} + ½ {ci.halfPizza2.name}</p>
              )}
              {ci.removedIngredients.length > 0 && (
                <p className="text-red-400 text-xs mt-0.5">✗ {ci.removedIngredients.join(", ")}</p>
              )}
              {ci.addedIngredients.length > 0 && (
                <p className="text-green-400 text-xs">+ {ci.addedIngredients.map(i => i.name).join(", ")}</p>
              )}
              {ci.manualAdditions?.length > 0 && (
                <p className="text-orange-300 text-xs">✏️ {ci.manualAdditions.map(m => m.name).join(", ")}</p>
              )}
              {ci.notes && <p className="text-gray-400 text-xs italic">"{ci.notes}"</p>}
              <p className="text-orange-400 text-xs font-semibold mt-0.5">
                €{ci.effectivePrice.toFixed(2)} × {ci.quantity} = €{(ci.effectivePrice * ci.quantity).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {!isDirect && menuItem && (
                <button onClick={() => p.onEditCartItem(menuItem, ci.cartId)}
                  className="w-9 h-9 bg-gray-600 hover:bg-blue-600 text-white rounded-xl text-sm flex items-center justify-center transition-colors">
                  ✏️
                </button>
              )}
              <button onClick={() => p.onRemoveCartItem(ci.cartId)}
                className="w-9 h-9 bg-gray-600 hover:bg-red-600 text-white rounded-xl font-bold text-lg flex items-center justify-center transition-colors">
                ×
              </button>
            </div>
          </div>
        </div>
      );
    })}
  </div>

  {/* Extra manuali */}
  <div className="px-3 pb-2 shrink-0 border-t border-gray-700 pt-3">
    <p className="text-gray-400 text-xs mb-2 font-semibold">➕ Extra manuale ordine</p>
    <div className="flex gap-1.5">
      <input value={p.newExtraDesc} onChange={e => p.onNewExtraDescChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && p.onAddExtra()}
        placeholder="Descrizione"
        className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-600" />
      <input value={p.newExtraPrice} onChange={e => p.onNewExtraPriceChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && p.onAddExtra()}
        placeholder="€" type="number" min={0} step={0.5}
        className="w-16 bg-gray-700 text-white rounded-xl px-2 py-2.5 text-sm outline-none border border-gray-600" />
      <button onClick={p.onAddExtra}
        className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-3 font-bold text-lg transition-colors">
        +
      </button>
    </div>
    {p.extras.map((e, i) => (
      <div key={i} className="flex justify-between items-center text-xs text-gray-300 mt-1.5">
        <span>{e.description}</span>
        <div className="flex items-center gap-2">
          <span className="text-orange-400">€{e.price.toFixed(2)}</span>
          <button onClick={() => p.onRemoveExtra(i)} className="text-gray-500 hover:text-red-400 text-base">×</button>
        </div>
      </div>
    ))}
  </div>

  {/* Note ordine */}
  <div className="px-3 pb-2 shrink-0">
    <textarea value={p.orderNotes} onChange={e => p.onOrderNotesChange(e.target.value)}
      placeholder="📋 Note cucina (ordine intero)..."
      rows={2}
      className="w-full bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none border border-gray-600 resize-none" />
  </div>

  {/* Totale */}
  <div className="px-3 pb-2 shrink-0 border-t border-gray-700 pt-2 space-y-1 text-sm">
    {totals.copertoTotal  > 0 && <div className="flex justify-between text-gray-400"><span>Coperto ({p.peopleCount} pers.)</span><span>€{totals.copertoTotal.toFixed(2)}</span></div>}
    {totals.deliveryTotal > 0 && <div className="flex justify-between text-gray-400"><span>Delivery</span><span>€{totals.deliveryTotal.toFixed(2)}</span></div>}
    {totals.extrasTotal   > 0 && <div className="flex justify-between text-gray-400"><span>Extra</span><span>€{totals.extrasTotal.toFixed(2)}</span></div>}
    <div className="flex justify-between text-white font-bold text-lg pt-1 border-t border-gray-600">
      <span>TOTALE</span>
      <span className="text-orange-400">€{totals.grand.toFixed(2)}</span>
    </div>
  </div>

  {/* Bottoni */}
  <div className="p-3 shrink-0 space-y-2 border-t border-gray-700">
    {p.success && <p className="text-green-400 text-sm text-center font-semibold animate-pulse">✅ Ordine inviato!</p>}
    <button onClick={p.onSubmit} disabled={p.cartItems.length === 0 || p.saving}
      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base transition-colors">
      {p.saving ? "⏳ Invio..." : `✅ Invia — €${totals.grand.toFixed(2)}`}
    </button>
    <div className="grid grid-cols-2 gap-2">
      <button onClick={p.onGoToCassa}
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-3 rounded-2xl transition-colors font-medium">
        💳 Cassa
      </button>
      <button onClick={p.onClearCart} disabled={p.cartItems.length === 0}
        className="bg-gray-700 hover:bg-red-700 disabled:opacity-40 text-gray-300 text-sm py-3 rounded-2xl transition-colors font-medium">
        🗑 Svuota
      </button>
    </div>
  </div>
</div>

);
}

// ─────────────────────────────────────────────────────────
// PAGINA PRINCIPALE
// ─────────────────────────────────────────────────────────
export default function OrdiniPage() {
const { loading } = useAuth();
const router = useRouter();

const [cartItems, setCartItems]             = useState<OrderItem[]>([]);
const [extras, setExtras]                   = useState<ExtraItem[]>([]);
const [newExtraDesc, setNewExtraDesc]       = useState(””);
const [newExtraPrice, setNewExtraPrice]     = useState(””);
const [orderType, setOrderType]             = useState<OrderType>(“asporto”);
const [tableNumber, setTableNumber]         = useState(1);
const [peopleCount, setPeopleCount]         = useState(2);
const [customerName, setCustomerName]       = useState(””);
const [deliveryAddress, setDeliveryAddress] = useState(””);
const [deliveryCost, setDeliveryCost]       = useState(2);
const [desiredTime, setDesiredTime]         = useState(””);
const [isUrgent, setIsUrgent]               = useState(false);
const [orderNotes, setOrderNotes]           = useState(””);
const [modalItem, setModalItem]             = useState<MenuItem | null>(null);
const [editingCartId, setEditingCartId]     = useState<string | null>(null);
const [activeCategory, setActiveCategory]   = useState<MenuCategory>(“pizze”);
const [dietFilter, setDietFilter]           = useState<DietTag | “tutti”>(“tutti”);
const [searchQuery, setSearchQuery]         = useState(””);
const [saving, setSaving]                   = useState(false);
const [success, setSuccess]                 = useState(false);
const [cartOpen, setCartOpen]               = useState(false);

if (loading) return (
<div className="flex items-center justify-center h-full">
<p className="text-white">Caricamento…</p>
</div>
);

// ── Prodotti filtrati + ordine alfabetico + custom sempre ultima ──
const displayedItems = useMemo(() => {
let items: typeof menu = [];

if (searchQuery.trim()) {
  const q = searchQuery.toLowerCase();
  items = menu.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.ingredients.some(i => i.toLowerCase().includes(q))
  );
} else {
  items = menu.filter(m =>
    m.category === activeCategory &&
    (dietFilter === "tutti" || m.tag === dietFilter)
  );
}

const pinned  = items.filter(i => i.id === "custom_pizza");
const regular = items
  .filter(i => i.id !== "custom_pizza")
  .sort((a, b) => a.name.localeCompare(b.name, "it"));

return [...regular, ...pinned];

}, [searchQuery, activeCategory, dietFilter]);

const menuById   = (id: string) => menu.find(m => m.id === id);
const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
const totals     = calcTotals(cartItems, extras, orderType, peopleCount, deliveryCost);

// ── Modal ──
const openModal = (item: MenuItem, cartId?: string) => {
setModalItem(item);
setEditingCartId(cartId ?? null);
};

const handleModalConfirm = (cartItem: OrderItem) => {
if (editingCartId) {
setCartItems(prev => prev.map(i => i.cartId === editingCartId ? cartItem : i));
} else {
setCartItems(prev => […prev, cartItem]);
}
setModalItem(null);
setEditingCartId(null);
};

// ── Aggiunta/rimozione diretta (bibite, fritti) ──
const directAdd = (item: MenuItem) => {
setCartItems(prev => {
const key = `${item.id}_direct`;
const ex  = prev.find(i => i.cartId === key);
if (ex) return prev.map(i => i.cartId === key ? { …i, quantity: i.quantity + 1 } : i);
return […prev, {
cartId: key, id: item.id, name: item.name, category: item.category,
size: “normale”, basePrice: item.price, effectivePrice: item.price,
quantity: 1, removedIngredients: [], addedIngredients: [], manualAdditions: [], notes: “”,
}];
});
};

const directRemove = (item: MenuItem) => {
const key = `${item.id}_direct`;
setCartItems(prev => {
const ex = prev.find(i => i.cartId === key);
if (!ex) return prev;
if (ex.quantity > 1) return prev.map(i => i.cartId === key ? { …i, quantity: i.quantity - 1 } : i);
return prev.filter(i => i.cartId !== key);
});
};

const removeCartItem = (cartId: string) =>
setCartItems(prev => prev.filter(i => i.cartId !== cartId));

const clearCart = () => { setCartItems([]); setExtras([]); };

const addExtra = () => {
if (!newExtraDesc.trim() || !newExtraPrice) return;
setExtras(prev => […prev, { description: newExtraDesc, price: parseFloat(newExtraPrice) }]);
setNewExtraDesc(””); setNewExtraPrice(””);
};

const submitOrder = async () => {
if (cartItems.length === 0) return;
setSaving(true);
try {
await createOrder({
type: orderType, status: “attesa”, items: cartItems, extras,
tableNumber:     orderType === “tavolo”   ? tableNumber    : undefined,
peopleCount:     orderType === “tavolo”   ? peopleCount    : undefined,
customerName:    orderType !== “tavolo”   ? customerName   : undefined,
deliveryAddress: orderType === “delivery” ? deliveryAddress : undefined,
deliveryCost:    orderType === “delivery” ? deliveryCost   : undefined,
desiredTime:     desiredTime || undefined,
isUrgent,
orderNotes:      orderNotes || undefined,
total:           totals.grand,
});
clearCart();
setCustomerName(””); setDeliveryAddress(””); setDesiredTime(””);
setPeopleCount(2); setTableNumber(1); setIsUrgent(false); setOrderNotes(””);
setSuccess(true); setCartOpen(false);
setTimeout(() => setSuccess(false), 3000);
} finally { setSaving(false); }
};

// Props condivise per OrderPanel
const panelProps: OrderPanelProps = {
cartItems, extras, orderType, tableNumber, peopleCount, customerName,
deliveryAddress, deliveryCost, desiredTime, isUrgent, orderNotes,
newExtraDesc, newExtraPrice, saving, success,
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
onGoToCassa:             () => router.push(”/dashboard/cassa”),
menuById,
};

// ── Griglia prodotti (condivisa) ──
const ProductGrid = ({ mobile = false }: { mobile?: boolean }) => (
<>
{displayedItems.map(item => {
const isDirect  = !MODAL_CATEGORIES.includes(item.category as MenuCategory);
const isCustom  = item.id === “custom_pizza”;
const directQty = cartItems.find(i => i.cartId === `${item.id}_direct`)?.quantity ?? 0;
const modalQty  = cartItems
.filter(i => i.id === item.id && !i.cartId.includes(“direct”))
.reduce((s, i) => s + i.quantity, 0);
const totalQty  = directQty + modalQty;

    return (
      <button
        key={item.id}
        onClick={() => isDirect ? directAdd(item) : openModal(item)}
        className={`border-2 rounded-2xl p-3 text-left transition-all ${
          isCustom
            ? totalQty > 0
              ? "bg-purple-900/30 border-purple-500"
              : "bg-purple-900/20 border-purple-800 hover:border-purple-600"
            : totalQty > 0
              ? "bg-orange-500/5 border-orange-500 bg-gray-800"
              : "bg-gray-800 border-gray-700 hover:border-gray-500"
        }`}>
        <div className="flex justify-between items-start mb-2">
          <p className={`font-bold text-sm leading-tight flex-1 pr-1 ${isCustom ? "text-purple-300" : "text-white"}`}>
            {item.name}
          </p>
          {totalQty > 0 && (
            <span className={`text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shrink-0 ${isCustom ? "bg-purple-600" : "bg-orange-500"}`}>
              {totalQty}
            </span>
          )}
        </div>
        {item.note && <p className="text-gray-500 text-xs mb-1 italic">{item.note}</p>}
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-black text-base ${isCustom ? "text-purple-400" : "text-orange-400"}`}>
            €{item.price.toFixed(2)}
          </span>
          {item.maxiPrice && (
            <span className="text-yellow-600 text-xs font-semibold">M:€{item.maxiPrice}</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          item.tag === "vegetariano" ? "bg-green-700 text-green-100" :
          item.tag === "vegano"      ? "bg-emerald-700 text-emerald-100" :
                                      "bg-gray-600 text-gray-200"
        }`}>
          {item.tag === "vegetariano" ? "🌿" : item.tag === "vegano" ? "🥦" : "🍽"}
        </span>
        {!isDirect && (
          <p className={`text-xs mt-1.5 ${isCustom ? "text-purple-700" : "text-gray-600"}`}>
            ✏️ tocca per personalizzare
          </p>
        )}
        {isDirect && directQty > 0 && (
          <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => directRemove(item)}
              className="w-8 h-8 bg-gray-600 active:bg-red-600 text-white rounded-xl text-lg font-bold flex items-center justify-center transition-colors">−</button>
            <span className="text-white font-bold">{directQty}</span>
            <button onClick={() => directAdd(item)}
              className="w-8 h-8 bg-gray-600 active:bg-green-600 text-white rounded-xl text-lg font-bold flex items-center justify-center transition-colors">+</button>
          </div>
        )}
      </button>
    );
  })}
</>

);

return (
<>
{/* MODAL PERSONALIZZAZIONE */}
{modalItem && (
<ItemCustomizeModal
item={modalItem}
existingCartItem={editingCartId ? cartItems.find(i => i.cartId === editingCartId) : undefined}
onConfirm={handleModalConfirm}
onClose={() => { setModalItem(null); setEditingCartId(null); }}
/>
)}

  {/* ════════════ LAYOUT DESKTOP (md+) ════════════ */}
  <div className="hidden md:flex gap-4 h-[calc(100vh-80px)]">

    {/* Colonna menu */}
    <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
      <input
        type="text" value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onFocus={() => setSearchQuery("")}
        placeholder="🔍  Cerca prodotto o ingrediente..."
        className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500 border border-gray-700"
      />
      {!searchQuery && (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(categoryLabels) as MenuCategory[]).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["tutti", "normale", "vegetariano", "vegano"] as const).map(f => (
              <button key={f} onClick={() => setDietFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  dietFilter === f ? "border-white bg-white text-gray-900" : "border-gray-600 text-gray-400"
                }`}>
                {f === "tutti" ? "🍽 Tutti" : f === "vegetariano" ? "🌿 Veg" : f === "vegano" ? "🥦 Vegano" : "Normale"}
              </button>
            ))}
          </div>
        </>
      )}
      {searchQuery && (
        <p className="text-gray-400 text-sm shrink-0">
          {displayedItems.length} risultati per <span className="text-orange-400">"{searchQuery}"</span>
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 overflow-y-auto pr-1 pb-2">
        {displayedItems.length === 0 && (
          <div className="col-span-3 text-center text-gray-500 mt-10">
            <p className="text-4xl mb-2">🔍</p>
            <p>Nessun prodotto trovato</p>
          </div>
        )}
        <ProductGrid />
      </div>
    </div>

    {/* Pannello ordine */}
    <div className="w-80 bg-gray-800 rounded-2xl flex flex-col overflow-hidden border border-gray-700">
      <div className="px-4 pt-3 pb-2 border-b border-gray-700 shrink-0 flex items-center justify-between">
        <h2 className="text-white font-bold">🧾 Ordine</h2>
        <div className="flex items-center gap-2">
          {totalItems > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{totalItems}</span>
          )}
          {isUrgent && <span className="text-red-400 text-xs font-bold animate-pulse">🔴 URGENTE</span>}
        </div>
      </div>
      <OrderPanel {...panelProps} />
    </div>
  </div>

  {/* ════════════ LAYOUT MOBILE ════════════ */}
  <div className="md:hidden flex flex-col h-full overflow-hidden">

    {/* Barra search + filtri */}
    <div className="shrink-0 space-y-2 mb-2">
      <input
        type="text" value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onFocus={() => setSearchQuery("")}
        placeholder="🔍  Cerca prodotto..."
        className="w-full bg-gray-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 border border-gray-700 text-base"
      />
      {!searchQuery && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(Object.keys(categoryLabels) as MenuCategory[]).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                  activeCategory === cat ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"
                }`}>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(["tutti", "normale", "vegetariano", "vegano"] as const).map(f => (
              <button key={f} onClick={() => setDietFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border shrink-0 transition-colors ${
                  dietFilter === f ? "border-orange-500 bg-orange-500/20 text-orange-300" : "border-gray-600 text-gray-400"
                }`}>
                {f === "tutti" ? "🍽 Tutti" : f === "vegetariano" ? "🌿 Veg" : f === "vegano" ? "🥦 Vegano" : "Normale"}
              </button>
            ))}
          </div>
        </>
      )}
      {searchQuery && (
        <p className="text-gray-400 text-sm">
          {displayedItems.length} risultati per <span className="text-orange-400">"{searchQuery}"</span>
        </p>
      )}
    </div>

    {/* Griglia prodotti */}
    <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2.5 pb-2 content-start">
      {displayedItems.length === 0 && (
        <div className="col-span-2 text-center text-gray-500 mt-10">
          <p className="text-4xl mb-2">🔍</p>
          <p>Nessun prodotto trovato</p>
        </div>
      )}
      <ProductGrid mobile />
    </div>

    {/* FAB carrello */}
    {totalItems > 0 && !cartOpen && (
      <button onClick={() => setCartOpen(true)}
        className="fixed bottom-20 right-4 z-30 bg-orange-500 text-white rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 font-bold text-base active:scale-95 transition-transform">
        <span className="text-xl">🛒</span>
        <span>{totalItems} prodotti</span>
        <span className="bg-white/20 rounded-xl px-2 py-0.5">€{totals.grand.toFixed(2)}</span>
      </button>
    )}

    {/* Bottom sheet carrello */}
    {cartOpen && (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
        <div className="relative bg-gray-800 rounded-t-3xl flex flex-col z-10 max-h-[90vh]">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700 shrink-0">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-600 rounded-full" />
            <div className="flex items-center gap-3">
              <h2 className="text-white font-bold text-lg">🧾 Il tuo ordine</h2>
              <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{totalItems}</span>
            </div>
            <button onClick={() => setCartOpen(false)}
              className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center hover:text-white">×</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <OrderPanel {...panelProps} />
          </div>
        </div>
      </div>
    )}
  </div>
</>

);
}
