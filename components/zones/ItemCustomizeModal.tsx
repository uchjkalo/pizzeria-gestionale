"use client";

import { useState } from "react";
import { MenuItem, EXTRA_INGREDIENTS } from "@/lib/menu";
import { OrderItem, ItemSize } from "@/types";

interface Props {
  item: MenuItem;
  existingCartItem?: OrderItem;
  onConfirm: (cartItem: OrderItem) => void;
  onClose: () => void;
}

const getSizedPrice = (item: MenuItem, size: ItemSize): number => {
  if (size === "baby") return Math.max(0, item.price - 1);
  if (size === "maxi") return item.maxiPrice ?? item.price;
  return item.price;
};

export default function ItemCustomizeModal({ item, existingCartItem, onConfirm, onClose }: Props) {
  const isPizza = item.category === "pizze";
  const hasMaxi  = isPizza && !!item.maxiPrice;
  const hasBaby  = isPizza;

  const [size, setSize]                       = useState<ItemSize>(existingCartItem?.size ?? "normale");
  const [removedIngredients, setRemoved]      = useState<string[]>(existingCartItem?.removedIngredients ?? []);
  const [addedIngredients, setAdded]          = useState<{ name: string; price: number }[]>(existingCartItem?.addedIngredients ?? []);
  const [notes, setNotes]                     = useState(existingCartItem?.notes ?? "");
  const [quantity, setQuantity]               = useState(existingCartItem?.quantity ?? 1);
  const [extraTab, setExtraTab]               = useState<"base" | "speciale">("base");

  const basePrice     = getSizedPrice(item, size);
  const addedCost     = addedIngredients.reduce((s, i) => s + i.price, 0);
  const effectivePrice = basePrice + addedCost;
  const totalPrice    = effectivePrice * quantity;

  const toggleRemoved = (ing: string) =>
    setRemoved(prev => prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]);

  const toggleAdded = (extra: { name: string; price: number }) =>
    setAdded(prev => {
      const exists = prev.find(i => i.name === extra.name);
      return exists ? prev.filter(i => i.name !== extra.name) : [...prev, extra];
    });

  const handleConfirm = () => {
    onConfirm({
      cartId:              existingCartItem?.cartId ?? `${item.id}_${Date.now()}`,
      id:                  item.id,
      name:                item.name,
      category:            item.category,
      size,
      basePrice:           item.price,
      effectivePrice,
      quantity,
      removedIngredients,
      addedIngredients,
      notes,
    });
  };

  const quickNotes = ["Ben cotta", "Poco sale", "Piccante", "Senza aglio", "Allergie: ___", "Per bambino"];

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-white text-xl font-bold">{item.name}</h2>
            <div className="flex gap-2 mt-1 flex-wrap">
              {item.note && (
                <span className="text-xs bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full">{item.note}</span>
              )}
              <span className="text-orange-400 text-sm font-semibold">€{item.price.toFixed(2)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* BODY scrollabile */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">

          {/* ── DIMENSIONE (solo pizze) ── */}
          {(hasBaby || hasMaxi) && (
            <section>
              <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">📏 Dimensione</p>
              <div className="grid grid-cols-3 gap-2">

                {hasBaby && (
                  <button onClick={() => setSize("baby")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${size === "baby" ? "border-blue-500 bg-blue-500/20" : "border-gray-600 bg-gray-700 hover:border-gray-500"}`}>
                    <div className="text-lg">🍼</div>
                    <div className="text-white font-bold text-sm mt-0.5">Baby</div>
                    <div className="text-blue-400 text-xs font-semibold">€{(item.price - 1).toFixed(2)}</div>
                    <div className="text-gray-400 text-xs">-€1.00</div>
                  </button>
                )}

                <button onClick={() => setSize("normale")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${size === "normale" ? "border-orange-500 bg-orange-500/20" : "border-gray-600 bg-gray-700 hover:border-gray-500"}`}>
                  <div className="text-lg">🍕</div>
                  <div className="text-white font-bold text-sm mt-0.5">Normale</div>
                  <div className="text-orange-400 text-xs font-semibold">€{item.price.toFixed(2)}</div>
                  <div className="text-gray-400 text-xs">standard</div>
                </button>

                {hasMaxi && (
                  <button onClick={() => setSize("maxi")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${size === "maxi" ? "border-yellow-500 bg-yellow-500/20" : "border-gray-600 bg-gray-700 hover:border-gray-500"}`}>
                    <div className="text-lg">🔥</div>
                    <div className="text-white font-bold text-sm mt-0.5">MAXI</div>
                    <div className="text-yellow-400 text-xs font-semibold">€{item.maxiPrice!.toFixed(2)}</div>
                    <div className="text-gray-400 text-xs">grande</div>
                  </button>
                )}

              </div>
            </section>
          )}

          {/* ── TOGLI INGREDIENTI ── */}
          {item.ingredients.length > 0 && (
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
                <p className="text-red-400 text-xs mt-1.5">
                  Senza: {removedIngredients.join(", ")}
                </p>
              )}
            </section>
          )}

          {/* ── AGGIUNGI INGREDIENTI ── */}
          <section>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">➕ Aggiungi ingredienti</p>

            {/* Tab base / speciale */}
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
                      isAdded
                        ? "border-green-500 bg-green-500/20 text-green-300"
                        : "border-gray-600 bg-gray-700 text-gray-300 hover:border-green-400"
                    }`}>
                    <span>{isAdded ? "✓ " : ""}{extra.name}</span>
                    <span className={`text-xs font-semibold ${isAdded ? "text-green-400" : "text-gray-400"}`}>
                      +€{extra.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            {addedIngredients.length > 0 && (
              <p className="text-green-400 text-xs mt-1.5">
                Aggiunti: {addedIngredients.map(i => i.name).join(", ")}
              </p>
            )}
          </section>

          {/* ── NOTE ── */}
          <section>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">📝 Note</p>
            {/* Scorciatoie rapide */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickNotes.map(n => (
                <button key={n} onClick={() => setNotes(prev => prev ? `${prev}, ${n}` : n)}
                  className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs border border-gray-600 transition-colors">
                  {n}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Note libere per la cucina..."
              rows={2}
              className="w-full bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none border border-gray-600" />
          </section>

          {/* ── QUANTITÀ ── */}
          <section className="flex items-center justify-between bg-gray-700/50 rounded-xl px-4 py-3">
            <p className="text-gray-200 font-semibold">Quantità</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 bg-gray-600 hover:bg-red-600 text-white rounded-xl font-bold text-xl transition-colors">−</button>
              <span className="text-white text-2xl font-bold w-6 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 bg-gray-600 hover:bg-green-600 text-white rounded-xl font-bold text-xl transition-colors">+</button>
            </div>
          </section>

          {/* ── RIEPILOGO PREZZI ── */}
          <section className="bg-gray-700/40 rounded-xl p-3 space-y-1 text-sm border border-gray-700">
            <div className="flex justify-between text-gray-300">
              <span>Base ({size})</span>
              <span>€{basePrice.toFixed(2)}</span>
            </div>
            {addedIngredients.map(i => (
              <div key={i.name} className="flex justify-between text-green-300">
                <span>+ {i.name}</span>
                <span>+€{i.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-gray-600 pt-2 flex justify-between text-white font-bold text-base">
              <span>Unitario</span>
              <span>€{effectivePrice.toFixed(2)}</span>
            </div>
            {quantity > 1 && (
              <div className="flex justify-between text-orange-400 font-bold text-base">
                <span>Totale × {quantity}</span>
                <span>€{totalPrice.toFixed(2)}</span>
              </div>
            )}
          </section>

        </div>

        {/* FOOTER fisso */}
        <div className="p-4 border-t border-gray-700 shrink-0">
          <button onClick={handleConfirm}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors text-lg">
            {existingCartItem ? "✏️ Aggiorna" : "✅ Aggiungi"} — €{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}