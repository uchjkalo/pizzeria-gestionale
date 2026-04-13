"use client";

import { useState } from "react";
import { MenuItem, EXTRA_INGREDIENTS, menu } from "@/lib/menu";
import { OrderItem, ItemSize, ManualAddition } from "@/types";

interface Props {
  item: MenuItem;
  existingCartItem?: OrderItem;
  onConfirm: (cartItem: OrderItem) => void;
  onClose: () => void;
}

const getSizedPrice = (basePrice: number, size: ItemSize): number => {
  if (size === "baby") return Math.max(0, basePrice - 1);
  if (size === "maxi") return basePrice; // override se maxiPrice disponibile
  return basePrice;
};

const getSizedPriceFromItem = (item: MenuItem, size: ItemSize): number => {
  if (size === "baby") return Math.max(0, item.price - 1);
  if (size === "maxi") return item.maxiPrice ?? item.price;
  return item.price;
};

const isCustom = (item: MenuItem) => item.id === "custom_pizza";
const isPizza  = (item: MenuItem) => item.category === "pizze";

// Pizze disponibili per metà e metà (esclude pizza personalizzata)
const PIZZE_LIST = menu
  .filter(m => m.category === "pizze" && m.id !== "custom_pizza")
  .sort((a, b) => a.name.localeCompare(b.name, "it"));

export default function ItemCustomizeModal({ item, existingCartItem, onConfirm, onClose }: Props) {
  const custom = isCustom(item);
  const pizza  = isPizza(item);
  const hasMaxi = pizza && !!item.maxiPrice && !custom;
  const hasBaby = pizza;

  // Dimensione
  const [size, setSize] = useState<ItemSize>(existingCartItem?.size ?? "normale");

  // Ingredienti
  const [removedIngredients, setRemoved] = useState<string[]>(existingCartItem?.removedIngredients ?? []);
  const [addedIngredients, setAdded]     = useState<{ name: string; price: number }[]>(existingCartItem?.addedIngredients ?? []);
  const [extraTab, setExtraTab]          = useState<"base" | "speciale">("base");

  // Aggiunte manuali (per tutti)
  const [manualAdditions, setManual]     = useState<ManualAddition[]>(existingCartItem?.manualAdditions ?? []);
  const [manualName, setManualName]      = useState("");
  const [manualPrice, setManualPrice]    = useState("");

  // Note
  const [notes, setNotes]   = useState(existingCartItem?.notes ?? "");
  const [quantity, setQty]  = useState(existingCartItem?.quantity ?? 1);

  // Pizza personalizzata
  const [customName, setCustomName]     = useState(existingCartItem?.customName ?? "");
  const [isHalf, setIsHalf]             = useState(existingCartItem?.isHalf ?? false);
  const [half1Id, setHalf1Id]           = useState(existingCartItem?.halfPizza1?.id ?? "");
  const [half2Id, setHalf2Id]           = useState(existingCartItem?.halfPizza2?.id ?? "");
  const [customBasePrice, setCustomBasePrice] = useState(existingCartItem?.basePrice ?? 6);

  // Ricerca metà-pizze
  const [halfSearch1, setHalfSearch1]   = useState("");
  const [halfSearch2, setHalfSearch2]   = useState("");

  // ── Calcolo prezzo ──
  const half1 = PIZZE_LIST.find(p => p.id === half1Id);
  const half2 = PIZZE_LIST.find(p => p.id === half2Id);

  let basePrice: number;
  if (custom) {
    if (isHalf && half1 && half2) {
      const h1p = getSizedPriceFromItem(half1, size);
      const h2p = getSizedPriceFromItem(half2, size);
      basePrice = (h1p + h2p) / 2;
    } else {
      basePrice = getSizedPrice(customBasePrice, size);
    }
  } else {
    basePrice = getSizedPriceFromItem(item, size);
  }

  const addedCost   = addedIngredients.reduce((s, i) => s + i.price, 0);
  const manualCost  = manualAdditions.reduce((s, m) => s + m.price, 0);
  const effectivePrice = basePrice + addedCost + manualCost;
  const totalPrice  = effectivePrice * quantity;

  const toggleRemoved = (ing: string) =>
    setRemoved(prev => prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]);

  const toggleAdded = (extra: { name: string; price: number }) =>
    setAdded(prev => {
      const ex = prev.find(i => i.name === extra.name);
      return ex ? prev.filter(i => i.name !== extra.name) : [...prev, extra];
    });

  const addManual = () => {
    if (!manualName.trim() || !manualPrice) return;
    setManual(prev => [...prev, { name: manualName.trim(), price: parseFloat(manualPrice) }]);
    setManualName(""); setManualPrice("");
  };

  const removeManual = (idx: number) =>
    setManual(prev => prev.filter((_, i) => i !== idx));

  const canConfirm = custom ? (!isHalf ? customName.trim().length > 0 : (!!half1 && !!half2 && customName.trim().length > 0)) : true;

  const handleConfirm = () => {
    if (!canConfirm) return;

    const finalName = custom
      ? (customName.trim() || "Pizza Personalizzata")
      : item.name;

    onConfirm({
      cartId:              existingCartItem?.cartId ?? `${item.id}_${Date.now()}`,
      id:                  item.id,
      name:                finalName,
      category:            item.category,
      size,
      basePrice:           custom ? customBasePrice : item.price,
      effectivePrice,
      quantity,
      removedIngredients,
      addedIngredients,
      manualAdditions,
      notes,
      customName:          custom ? customName.trim() : undefined,
      isHalf:              custom ? isHalf : undefined,
      halfPizza1:          custom && isHalf && half1 ? { id: half1.id, name: half1.name, price: half1.price } : undefined,
      halfPizza2:          custom && isHalf && half2 ? { id: half2.id, name: half2.name, price: half2.price } : undefined,
    });
  };

  const quickNotes = ["Ben cotta", "Poco sale", "Piccante", "Senza aglio", "Allergia: ___", "Per bambino"];

  const filteredHalf1 = PIZZE_LIST.filter(p =>
    p.id !== half2Id && p.name.toLowerCase().includes(halfSearch1.toLowerCase())
  );
  const filteredHalf2 = PIZZE_LIST.filter(p =>
    p.id !== half1Id && p.name.toLowerCase().includes(halfSearch2.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-start shrink-0">
          <div>
            <h2 className={`text-xl font-bold ${custom ? "text-purple-300" : "text-white"}`}>
              {custom ? "🎨 Pizza Personalizzata" : item.name}
            </h2>
            <div className="flex gap-2 mt-1 flex-wrap">
              {item.note && <span className="text-xs bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full">{item.note}</span>}
              {!custom && <span className="text-orange-400 text-sm font-semibold">€{item.price.toFixed(2)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">

          {/* ── PIZZA PERSONALIZZATA: nome + modalità ── */}
          {custom && (
            <section className="space-y-3">
              <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">🎨 Configura la pizza</p>

              {/* Nome */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nome pizza <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Es. Margherita speciale..."
                  className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600 text-sm"
                />
              </div>

              {/* Toggle metà e metà */}
              <div className="flex gap-2">
                <button onClick={() => setIsHalf(false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${!isHalf ? "border-orange-500 bg-orange-500/20 text-orange-300" : "border-gray-600 bg-gray-700 text-gray-400"}`}>
                  🍕 Pizza intera
                </button>
                <button onClick={() => setIsHalf(true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${isHalf ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-gray-600 bg-gray-700 text-gray-400"}`}>
                  🍕🍕 Metà e Metà
                </button>
              </div>

              {/* Prezzo base pizza intera */}
              {!isHalf && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Prezzo base (€)</label>
                  <input
                    type="number" min={0} step={0.5}
                    value={customBasePrice}
                    onChange={e => setCustomBasePrice(+e.target.value)}
                    className="w-32 bg-gray-700 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 border border-gray-600 text-sm"
                  />
                </div>
              )}

              {/* Selettori metà e metà */}
              {isHalf && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Prima metà */}
                  <div>
                    <p className="text-gray-400 text-xs font-semibold mb-1">🍕 Prima metà</p>
                    <input
                      type="text" value={halfSearch1} onChange={e => setHalfSearch1(e.target.value)}
                      placeholder="Cerca pizza..."
                      className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-600 mb-1"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-900/50 rounded-lg p-1">
                      {filteredHalf1.map(p => (
                        <button key={p.id} onClick={() => { setHalf1Id(p.id); setHalfSearch1(""); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${half1Id === p.id ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>
                          {p.name} <span className="text-gray-400">€{p.price}</span>
                        </button>
                      ))}
                    </div>
                    {half1 && <p className="text-purple-400 text-xs mt-1 font-semibold">✓ {half1.name}</p>}
                  </div>

                  {/* Seconda metà */}
                  <div>
                    <p className="text-gray-400 text-xs font-semibold mb-1">🍕 Seconda metà</p>
                    <input
                      type="text" value={halfSearch2} onChange={e => setHalfSearch2(e.target.value)}
                      placeholder="Cerca pizza..."
                      className="w-full bg-gray-700 text-white rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-600 mb-1"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-900/50 rounded-lg p-1">
                      {filteredHalf2.map(p => (
                        <button key={p.id} onClick={() => { setHalf2Id(p.id); setHalfSearch2(""); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${half2Id === p.id ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>
                          {p.name} <span className="text-gray-400">€{p.price}</span>
                        </button>
                      ))}
                    </div>
                    {half2 && <p className="text-purple-400 text-xs mt-1 font-semibold">✓ {half2.name}</p>}
                  </div>
                </div>
              )}

              {isHalf && half1 && half2 && (
                <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-3 text-sm text-purple-300">
                  Prezzo metà: (€{half1.price} + €{half2.price}) / 2 = <span className="font-bold">€{((half1.price + half2.price) / 2).toFixed(2)}</span>
                </div>
              )}
            </section>
          )}

          {/* ── DIMENSIONE (solo pizze) ── */}
          {pizza && (hasBaby || hasMaxi) && (
            <section>
              <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">📏 Dimensione</p>
              <div className="grid grid-cols-3 gap-2">
                {hasBaby && (
                  <button onClick={() => setSize("baby")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${size === "baby" ? "border-blue-500 bg-blue-500/20" : "border-gray-600 bg-gray-700"}`}>
                    <div className="text-lg">🍼</div>
                    <div className="text-white font-bold text-sm">Baby</div>
                    <div className="text-blue-400 text-xs">-€1.00</div>
                  </button>
                )}
                <button onClick={() => setSize("normale")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${size === "normale" ? "border-orange-500 bg-orange-500/20" : "border-gray-600 bg-gray-700"}`}>
                  <div className="text-lg">🍕</div>
                  <div className="text-white font-bold text-sm">Normale</div>
                  <div className="text-orange-400 text-xs">standard</div>
                </button>
                {hasMaxi && (
                  <button onClick={() => setSize("maxi")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${size === "maxi" ? "border-yellow-500 bg-yellow-500/20" : "border-gray-600 bg-gray-700"}`}>
                    <div className="text-lg">🔥</div>
                    <div className="text-white font-bold text-sm">MAXI</div>
                    <div className="text-yellow-400 text-xs">€{item.maxiPrice}</div>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ── TOGLI INGREDIENTI (solo se ha ingredienti base) ── */}
          {item.ingredients.length > 0 && !custom && (
            <section>
              <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">🚫 Togli ingredienti</p>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map(ing => (
                  <button key={ing} onClick={() => toggleRemoved(ing)}
                    className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-all ${
                      removedIngredients.includes(ing)
                        ? "border-red-500 bg-red-500/20 text-red-300 line-through opacity-70"
                        : "border-gray-600 bg-gray-700 text-gray-200 hover:border-red-400"
                    }`}>
                    {ing}
                  </button>
                ))}
              </div>
              {removedIngredients.length > 0 && (
                <p className="text-red-400 text-xs mt-1.5">Senza: {removedIngredients.join(", ")}</p>
              )}
            </section>
          )}

          {/* ── AGGIUNGI INGREDIENTI ── */}
          <section>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">➕ Aggiungi ingredienti</p>
            <div className="flex gap-1 mb-3">
              <button onClick={() => setExtraTab("base")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${extraTab === "base" ? "bg-gray-500 text-white" : "bg-gray-700 text-gray-400"}`}>
                Base (+€1)
              </button>
              <button onClick={() => setExtraTab("speciale")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${extraTab === "speciale" ? "bg-gray-500 text-white" : "bg-gray-700 text-gray-400"}`}>
                Speciali (+€2/3)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {EXTRA_INGREDIENTS.filter(e => e.type === extraTab).map(extra => {
                const isAdded = !!addedIngredients.find(i => i.name === extra.name);
                return (
                  <button key={extra.name} onClick={() => toggleAdded(extra)}
                    className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm border transition-all ${
                      isAdded ? "border-green-500 bg-green-500/20 text-green-300" : "border-gray-600 bg-gray-700 text-gray-300 hover:border-green-400"
                    }`}>
                    <span>{isAdded ? "✓ " : ""}{extra.name}</span>
                    <span className={`text-xs font-semibold ${isAdded ? "text-green-400" : "text-gray-400"}`}>+€{extra.price}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── AGGIUNTE MANUALI (testo libero + prezzo) ── */}
          <section>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">✏️ Aggiunta personalizzata</p>
            <div className="flex gap-2 mb-2">
              <input
                value={manualName} onChange={e => setManualName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addManual()}
                placeholder="Nome aggiunta..."
                className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none border border-gray-600"
              />
              <input
                value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addManual()}
                placeholder="€" type="number" min={0} step={0.5}
                className="w-16 bg-gray-700 text-white rounded-xl px-2 py-2 text-sm outline-none border border-gray-600"
              />
              <button onClick={addManual}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-3 font-bold text-lg transition-colors">+</button>
            </div>
            {manualAdditions.length > 0 && (
              <div className="space-y-1.5">
                {manualAdditions.map((m, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-700/50 rounded-lg px-3 py-1.5">
                    <span className="text-orange-300 text-sm">✓ {m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 text-xs font-bold">+€{m.price.toFixed(2)}</span>
                      <button onClick={() => removeManual(i)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── NOTE ── */}
          <section>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">📝 Note</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickNotes.map(n => (
                <button key={n} onClick={() => setNotes(prev => prev ? `${prev}, ${n}` : n)}
                  className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs border border-gray-600">
                  {n}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Note per la cucina..." rows={2}
              className="w-full bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none resize-none border border-gray-600" />
          </section>

          {/* ── QUANTITÀ ── */}
          <section className="flex items-center justify-between bg-gray-700/50 rounded-xl px-4 py-3">
            <p className="text-gray-200 font-semibold">Quantità</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 bg-gray-600 hover:bg-red-600 text-white rounded-xl font-bold text-xl transition-colors">−</button>
              <span className="text-white text-2xl font-bold w-6 text-center">{quantity}</span>
              <button onClick={() => setQty(q => q + 1)}
                className="w-10 h-10 bg-gray-600 hover:bg-green-600 text-white rounded-xl font-bold text-xl transition-colors">+</button>
            </div>
          </section>

          {/* ── RIEPILOGO PREZZI ── */}
          <section className="bg-gray-700/40 rounded-xl p-3 space-y-1 text-sm border border-gray-700">
            <div className="flex justify-between text-gray-300">
              <span>Base {custom && isHalf && half1 && half2 ? `(${half1.name} + ${half2.name}) / 2` : `(${size})`}</span>
              <span>€{basePrice.toFixed(2)}</span>
            </div>
            {addedIngredients.map(i => (
              <div key={i.name} className="flex justify-between text-green-300">
                <span>+ {i.name}</span><span>+€{i.price.toFixed(2)}</span>
              </div>
            ))}
            {manualAdditions.map((m, i) => (
              <div key={i} className="flex justify-between text-orange-300">
                <span>+ {m.name}</span><span>+€{m.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-gray-600 pt-2 flex justify-between text-white font-bold text-base">
              <span>Unitario</span><span>€{effectivePrice.toFixed(2)}</span>
            </div>
            {quantity > 1 && (
              <div className="flex justify-between text-orange-400 font-bold">
                <span>Totale × {quantity}</span><span>€{totalPrice.toFixed(2)}</span>
              </div>
            )}
          </section>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-700 shrink-0">
          {custom && !customName.trim() && (
            <p className="text-red-400 text-xs text-center mb-2">⚠️ Inserisci il nome della pizza</p>
          )}
          {custom && isHalf && (!half1 || !half2) && (
            <p className="text-red-400 text-xs text-center mb-2">⚠️ Seleziona entrambe le metà</p>
          )}
          <button onClick={handleConfirm} disabled={!canConfirm}
            className={`w-full font-bold py-3.5 rounded-xl transition-colors text-lg ${
              canConfirm ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}>
            {existingCartItem ? "✏️ Aggiorna" : "✅ Aggiungi"} — €{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
