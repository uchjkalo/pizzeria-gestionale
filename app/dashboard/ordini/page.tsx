"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { menu, MenuItem, MenuCategory, categoryLabels, tagColors, DietTag } from "@/lib/menu";
import { createOrder } from "@/lib/orders";
import { OrderItem, OrderType, ExtraItem } from "@/types";
import ItemCustomizeModal from "@/components/zones/ItemCustomizeModal";
import { useRouter } from "next/navigation";

// Categorie che aprono il modal di personalizzazione
const MODAL_CATEGORIES: MenuCategory[] = ["pizze", "panini", "burger", "specialita"];

// Calcolo totale ordine
const calcTotals = (
  items: OrderItem[],
  extras: ExtraItem[],
  type: OrderType,
  peopleCount: number,
  deliveryCost: number
) => {
  const itemsTotal   = items.reduce((s, i) => s + i.effectivePrice * i.quantity, 0);
  const extrasTotal  = extras.reduce((s, e) => s + e.price, 0);
  const copertoTotal = type === "tavolo" ? peopleCount : 0;
  const deliveryTotal = type === "delivery" ? deliveryCost : 0;
  return { itemsTotal, extrasTotal, copertoTotal, deliveryTotal, grand: itemsTotal + extrasTotal + copertoTotal + deliveryTotal };
};

export default function OrdiniPage() {
  const { loading } = useAuth();
  const router = useRouter();

  // ── Carrello ──
  const [cartItems, setCartItems]     = useState<OrderItem[]>([]);
  const [extras, setExtras]           = useState<ExtraItem[]>([]);
  const [newExtraDesc, setNewExtraDesc] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");

  // ── Dati ordine ──
  const [orderType, setOrderType]         = useState<OrderType>("asporto");
  const [tableNumber, setTableNumber]     = useState(1);
  const [peopleCount, setPeopleCount]     = useState(2);
  const [customerName, setCustomerName]   = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCost, setDeliveryCost]   = useState(2);
  const [desiredTime, setDesiredTime]     = useState("");
  const [isUrgent, setIsUrgent]           = useState(false);
  const [orderNotes, setOrderNotes]       = useState("");

  // ── Modal personalizzazione ──
  const [modalItem, setModalItem]         = useState<MenuItem | null>(null);
  const [editingCartId, setEditingCartId] = useState<string | null>(null);

  // ── Navigazione menu ──
  const [activeCategory, setActiveCategory] = useState<MenuCategory>("pizze");
  const [dietFilter, setDietFilter]         = useState<DietTag | "tutti">("tutti");
  const [searchQuery, setSearchQuery]       = useState("");

  // ── UI ──
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Filtraggio prodotti ──
  const displayedItems = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return menu.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.ingredients.some(i => i != null && i.toLowerCase().includes(q))
      );
    }
    return menu.filter(item =>
      item.category === activeCategory &&
      (dietFilter === "tutti" || item.tag === dietFilter)
    );
  }, [searchQuery, activeCategory, dietFilter]);

  // ── Handlers modal ──
  const openModal = (item: MenuItem, cartId?: string) => {
    setModalItem(item);
    setEditingCartId(cartId ?? null);
  };

  const handleModalConfirm = (cartItem: OrderItem) => {
    if (editingCartId) {
      setCartItems(prev => prev.map(i => i.cartId === editingCartId ? cartItem : i));
    } else {
      setCartItems(prev => [...prev, cartItem]);
    }
    setModalItem(null);
    setEditingCartId(null);
  };

  const closeModal = () => {
    setModalItem(null);
    setEditingCartId(null);
  };

  // ── Handlers aggiunta diretta (bibite/fritti) ──
  const directAdd = (item: MenuItem) => {
    setCartItems(prev => {
      const key = `${item.id}_direct`;
      const existing = prev.find(i => i.cartId === key);
      if (existing) return prev.map(i => i.cartId === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        cartId: key, id: item.id, name: item.name, category: item.category,
        size: "normale", basePrice: item.price, effectivePrice: item.price,
        quantity: 1, removedIngredients: [], addedIngredients: [], notes: "",
      }];
    });
  };

  const directRemove = (item: MenuItem) => {
    const key = `${item.id}_direct`;
    setCartItems(prev => {
      const existing = prev.find(i => i.cartId === key);
      if (!existing) return prev;
      if (existing.quantity > 1) return prev.map(i => i.cartId === key ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.cartId !== key);
    });
  };

  const removeCartItem = (cartId: string) =>
    setCartItems(prev => prev.filter(i => i.cartId !== cartId));

  const clearCart = () => {
    setCartItems([]);
    setExtras([]);
  };

  // ── Extra manuali ──
  const addExtra = () => {
    if (!newExtraDesc.trim() || !newExtraPrice) return;
    setExtras(prev => [...prev, { description: newExtraDesc, price: parseFloat(newExtraPrice) }]);
    setNewExtraDesc(""); setNewExtraPrice("");
  };

  // ── Invio ordine ──
  const submitOrder = async () => {
    if (cartItems.length === 0) return;
    setSaving(true);
    try {
      await createOrder({
        type: orderType, status: "attesa",
        items: cartItems, extras,
        tableNumber:     orderType === "tavolo"    ? tableNumber    : undefined,
        peopleCount:     orderType === "tavolo"    ? peopleCount    : undefined,
        customerName:    orderType !== "tavolo"    ? customerName   : undefined,
        deliveryAddress: orderType === "delivery"  ? deliveryAddress : undefined,
        deliveryCost:    orderType === "delivery"  ? deliveryCost   : undefined,
        desiredTime:     desiredTime || undefined,
        isUrgent, orderNotes: orderNotes || undefined,
        total: totals.grand,
      });
      clearCart();
      setCustomerName(""); setDeliveryAddress(""); setDesiredTime("");
      setPeopleCount(2); setTableNumber(1); setIsUrgent(false); setOrderNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  const totals = calcTotals(cartItems, extras, orderType, peopleCount, deliveryCost);
  const totalItemsInCart = cartItems.reduce((s, i) => s + i.quantity, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white text-lg">Caricamento...</p></div>;

  return (
    <>
      {/* MODAL PERSONALIZZAZIONE */}
      {modalItem && (
        <ItemCustomizeModal
          item={modalItem}
          existingCartItem={editingCartId ? cartItems.find(i => i.cartId === editingCartId) : undefined}
          onConfirm={handleModalConfirm}
          onClose={closeModal}
        />
      )}

      <div className="flex gap-4 h-[calc(100vh-80px)]">

        {/* ════════════ COLONNA SINISTRA: Menu ════════════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍  Cerca prodotto o ingrediente..."
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500 border border-gray-700 pr-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xl">×</button>
            )}
          </div>

          {/* Categorie (nascoste durante ricerca) */}
          {!searchQuery && (
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
          )}

          {/* Filtro dieta (nascosto durante ricerca) */}
          {!searchQuery && (
            <div className="flex gap-2 items-center">
              <span className="text-gray-500 text-xs">Filtro:</span>
              {(["tutti", "normale", "vegetariano", "vegano"] as const).map(f => (
                <button key={f} onClick={() => setDietFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    dietFilter === f ? "border-white bg-white text-gray-900" : "border-gray-600 text-gray-400 hover:border-gray-400"
                  }`}>
                  {f === "tutti" ? "🍽 Tutti" : f === "vegetariano" ? "🌿 Veg" : "🥦 Vegano"}
                </button>
              ))}
              {searchQuery && <span className="text-orange-400 text-xs ml-auto">{displayedItems.length} risultati</span>}
            </div>
          )}

          {/* Risultati ricerca label */}
          {searchQuery && (
            <p className="text-gray-400 text-sm">
              {displayedItems.length} risultati per <span className="text-orange-400">"{searchQuery}"</span>
            </p>
          )}

          {/* GRIGLIA PRODOTTI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 overflow-y-auto pr-1 pb-2">
            {displayedItems.length === 0 && (
              <div className="col-span-3 text-center text-gray-500 mt-10">
                <p className="text-4xl mb-2">🔍</p>
                <p>Nessun prodotto trovato</p>
              </div>
            )}

            {displayedItems.map(item => {
              const isDirectAdd = !MODAL_CATEGORIES.includes(item.category as MenuCategory);
              const directQty   = cartItems.find(i => i.cartId === `${item.id}_direct`)?.quantity ?? 0;
              const modalQty    = cartItems.filter(i => i.id === item.id && !i.cartId.includes("direct")).reduce((s, i) => s + i.quantity, 0);
              const totalQty    = directQty + modalQty;

              return (
                <button
                  key={item.id}
                  onClick={() => isDirectAdd ? directAdd(item) : openModal(item)}
                  className={`bg-gray-800 hover:bg-gray-750 border-2 rounded-xl p-3 text-left transition-all group ${
                    totalQty > 0 ? "border-orange-500" : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {/* Header card */}
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex-1 pr-1">
                      <p className="text-white font-semibold text-sm leading-tight">{item.name}</p>
                      {item.note && (
                        <span className="text-xs text-gray-400 italic">{item.note}</span>
                      )}
                    </div>
                    {totalQty > 0 && (
                      <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                        {totalQty}
                      </span>
                    )}
                  </div>

                  {/* Prezzo */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-orange-400 font-bold text-sm">€{item.price.toFixed(2)}</span>
                    {item.maxiPrice && (
                      <span className="text-yellow-600 text-xs">MAXI €{item.maxiPrice}</span>
                    )}
                  </div>

                  {/* Tag dieta */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tagColors[item.tag]}`}>
                    {item.tag === "vegetariano" ? "🌿 veg" : item.tag === "vegano" ? "🥦 vegan" : "🍽 normale"}
                  </span>

                  {/* Ingredienti preview */}
                  {item.ingredients.length > 0 && (
                    <p className="text-gray-500 text-xs mt-1.5 leading-tight line-clamp-2">
                      {item.ingredients.join(", ")}
                    </p>
                  )}
                  {item.note && item.category === "bibite" && (
                    <p className="text-gray-500 text-xs mt-1 italic">{item.note}</p>
                  )}

                  {/* Pulsanti diretti per bibite/fritti */}
                  {isDirectAdd && directQty > 0 && (
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => directRemove(item)}
                        className="w-7 h-7 bg-gray-600 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors">−</button>
                      <span className="text-white text-sm font-bold">{directQty}</span>
                      <button onClick={() => directAdd(item)}
                        className="w-7 h-7 bg-gray-600 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors">+</button>
                    </div>
                  )}

                  {/* Indicatore "tocca per personalizzare" */}
                  {!isDirectAdd && (
                    <p className="text-gray-600 text-xs mt-1.5 group-hover:text-gray-400 transition-colors">
                      ✏️ tocca per personalizzare
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════════ COLONNA DESTRA: Ordine ════════════ */}
        <div className="w-72 xl:w-80 bg-gray-800 rounded-2xl flex flex-col overflow-hidden border border-gray-700">

          {/* Header pannello */}
          <div className="p-3 border-b border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-base">
                🧾 Ordine
                {totalItemsInCart > 0 && (
                  <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{totalItemsInCart}</span>
                )}
              </h2>
              {isUrgent && <span className="text-red-400 text-xs font-bold animate-pulse">🔴 URGENTE</span>}
            </div>

            {/* Tipo ordine */}
            <div className="grid grid-cols-3 gap-1">
              {(["tavolo", "asporto", "delivery"] as OrderType[]).map(t => (
                <button key={t} onClick={() => setOrderType(t)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    orderType === t ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}>
                  {t === "tavolo" ? "🪑 Tavolo" : t === "asporto" ? "🥡 Asporto" : "🚴 Delivery"}
                </button>
              ))}
            </div>
          </div>

          {/* Opzioni tipo ordine */}
          <div className="p-3 border-b border-gray-700 shrink-0 space-y-2">
            {orderType === "tavolo" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-xs">N° Tavolo</label>
                  <input type="number" min={1} value={tableNumber} onChange={e => setTableNumber(+e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Persone (€1/cad.)</label>
                  <input type="number" min={1} value={peopleCount} onChange={e => setPeopleCount(+e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
            )}

            {(orderType === "asporto" || orderType === "delivery") && (
              <div>
                <label className="text-gray-400 text-xs">Nome cliente</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
            )}

            {orderType === "delivery" && (
              <div className="space-y-1.5">
                <div>
                  <label className="text-gray-400 text-xs">Indirizzo</label>
                  <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Via Roma 1, Barcis"
                    className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Costo delivery (€)</label>
                  <input type="number" min={0} step={0.5} value={deliveryCost} onChange={e => setDeliveryCost(+e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
            )}

            {/* Orario desiderato + Urgente */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-xs">Orario desiderato</label>
                <input type="time" value={desiredTime} onChange={e => setDesiredTime(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex flex-col justify-end">
                <button onClick={() => setIsUrgent(u => !u)}
                  className={`py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    isUrgent ? "border-red-500 bg-red-500/20 text-red-300" : "border-gray-600 bg-gray-700 text-gray-400"
                  }`}>
                  🔴 Urgente
                </button>
              </div>
            </div>
          </div>

          {/* LISTA PRODOTTI nel carrello */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cartItems.length === 0 && (
              <div className="text-center text-gray-500 mt-6">
                <p className="text-3xl mb-2">🛒</p>
                <p className="text-sm">Nessun prodotto</p>
                <p className="text-xs mt-1">Seleziona dal menu</p>
              </div>
            )}

            {cartItems.map(ci => {
              const isDirect = ci.cartId.includes("_direct");
              const menuItem = menu.find(m => m.id === ci.id);
              return (
                <div key={ci.cartId} className="bg-gray-700/60 rounded-xl p-2.5 border border-gray-600">
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex-1 min-w-0">
                      {/* Nome + size badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white text-sm font-semibold leading-tight">{ci.name}</p>
                        {ci.size !== "normale" && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                            ci.size === "maxi" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                          }`}>
                            {ci.size.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Personalizzazioni */}
                      {ci.removedIngredients.length > 0 && (
                        <p className="text-red-400 text-xs mt-0.5 leading-tight">
                          ✗ {ci.removedIngredients.join(", ")}
                        </p>
                      )}
                      {ci.addedIngredients.length > 0 && (
                        <p className="text-green-400 text-xs leading-tight">
                          + {ci.addedIngredients.map(i => i.name).join(", ")}
                        </p>
                      )}
                      {ci.notes && (
                        <p className="text-gray-400 text-xs italic leading-tight">"{ci.notes}"</p>
                      )}

                      {/* Prezzo */}
                      <p className="text-orange-400 text-xs font-semibold mt-0.5">
                        €{ci.effectivePrice.toFixed(2)} × {ci.quantity} = <span className="text-orange-300">€{(ci.effectivePrice * ci.quantity).toFixed(2)}</span>
                      </p>
                    </div>

                    {/* Azioni */}
                    <div className="flex flex-col gap-1 shrink-0">
                      {!isDirect && menuItem && (
                        <button onClick={() => openModal(menuItem, ci.cartId)}
                          className="w-7 h-7 bg-gray-600 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center"
                          title="Modifica">✏️</button>
                      )}
                      <button onClick={() => removeCartItem(ci.cartId)}
                        className="w-7 h-7 bg-gray-600 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"
                        title="Rimuovi">×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* EXTRA MANUALI */}
          <div className="px-3 pb-2 shrink-0 border-t border-gray-700 pt-2">
            <p className="text-gray-400 text-xs mb-1.5 font-semibold">➕ Extra manuale</p>
            <div className="flex gap-1">
              <input value={newExtraDesc} onChange={e => setNewExtraDesc(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addExtra()}
                placeholder="Descrizione" className="flex-1 bg-gray-700 text-white rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-600" />
              <input value={newExtraPrice} onChange={e => setNewExtraPrice(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addExtra()}
                placeholder="€" type="number" min={0} step={0.5}
                className="w-12 bg-gray-700 text-white rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-600" />
              <button onClick={addExtra} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-2 text-sm font-bold transition-colors">+</button>
            </div>
            {extras.map((e, i) => (
              <div key={i} className="flex justify-between items-center text-xs text-gray-300 mt-1">
                <span>{e.description}</span>
                <div className="flex items-center gap-2">
                  <span className="text-orange-400">€{e.price.toFixed(2)}</span>
                  <button onClick={() => setExtras(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-red-400 text-sm">×</button>
                </div>
              </div>
            ))}
          </div>

          {/* NOTE ORDINE */}
          <div className="px-3 pb-2 shrink-0">
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="📋 Note per la cucina (ordine intero)..."
              rows={2}
              className="w-full bg-gray-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-orange-500 resize-none border border-gray-600" />
          </div>

          {/* RIEPILOGO TOTALE */}
          <div className="px-3 pb-2 shrink-0 border-t border-gray-700 pt-2 space-y-1 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Prodotti</span><span>€{totals.itemsTotal.toFixed(2)}</span>
            </div>
            {totals.copertoTotal > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Coperto ({peopleCount} pers.)</span><span>€{totals.copertoTotal.toFixed(2)}</span>
              </div>
            )}
            {totals.deliveryTotal > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Delivery</span><span>€{totals.deliveryTotal.toFixed(2)}</span>
              </div>
            )}
            {totals.extrasTotal > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Extra</span><span>€{totals.extrasTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-gray-600">
              <span>TOTALE</span><span className="text-orange-400">€{totals.grand.toFixed(2)}</span>
            </div>
          </div>

          {/* BOTTONI AZIONE */}
          <div className="p-3 shrink-0 space-y-2 border-t border-gray-700">
            {success && (
              <p className="text-green-400 text-sm text-center font-semibold animate-pulse">✅ Ordine inviato!</p>
            )}
            <button onClick={submitOrder} disabled={cartItems.length === 0 || saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-base">
              {saving ? "⏳ Invio in corso..." : `✅ Invia Ordine — €${totals.grand.toFixed(2)}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => router.push("/dashboard/cassa")}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded-xl transition-colors font-medium">
                💳 Vai a Cassa
              </button>
              <button onClick={clearCart} disabled={cartItems.length === 0}
                className="bg-gray-700 hover:bg-red-700 disabled:opacity-40 text-gray-300 text-xs py-2 rounded-xl transition-colors font-medium">
                🗑 Svuota
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}