"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, payOrder, updateOrder, revertPayment, cancelOrder } from "@/lib/orders";
import { Order } from "@/types";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const orderTypeLabel = (order: Order) => {
  if (order.type === "tavolo")  return `🪑 Tavolo ${order.tableNumber} (${order.peopleCount} pers.)`;
  if (order.type === "asporto") return `🥡 ${order.customerName || "Asporto"}`;
  return `🚴 ${order.customerName || order.deliveryAddress || "Delivery"}`;
};

const statusLabel = (s: string) => {
  switch (s) {
    case "attesa":       return { label: "⏳ In attesa",   color: "bg-gray-600 text-gray-200" };
    case "preparazione": return { label: "🔧 In prep.",    color: "bg-yellow-600 text-yellow-100" };
    case "pronto":       return { label: "🔧 Rifinitura",  color: "bg-orange-600 text-orange-100" };
    case "consegnato":   return { label: "✅ Consegnato",  color: "bg-blue-600 text-blue-100" };
    default:             return { label: s,                color: "bg-gray-600 text-gray-200" };
  }
};

// ─────────────────────────────────────────
// QUICK ITEMS per aggiungere al conto
// ─────────────────────────────────────────
const QUICK_ITEMS = [
  { label: "🍕 Pizza",      defaultPrice: 8.00  },
  { label: "🚴 Delivery",   defaultPrice: 2.00  },
  { label: "🪑 Portata",    defaultPrice: 1.00  },
  { label: "🥤 Bibita",     defaultPrice: 3.00  },
  { label: "💧 Acqua",      defaultPrice: 1.50  },
  { label: "🥪 Panino",     defaultPrice: 9.00  },
  { label: "🍔 Burger",     defaultPrice: 11.00 },
  { label: "🍟 Fritti",     defaultPrice: 3.50  },
  { label: "⭐ Specialità", defaultPrice: 12.00 },
  { label: "➕ Aggiunta",   defaultPrice: 1.00  },
  { label: "☕ Caffè",      defaultPrice: 1.50  },
  { label: "🍰 Dolce",      defaultPrice: 4.00  },
  { label: "🍺 Birra",      defaultPrice: 3.50  },
  { label: "🍷 Vino",       defaultPrice: 3.00  },
];

// ─────────────────────────────────────────
// MODALE PAGAMENTO
// ─────────────────────────────────────────
interface PayModalProps {
  order: Order;
  onConfirm: (
    method: "contanti" | "carta",
    felice: boolean,
    quickExtras: { label: string; price: number }[]
  ) => void;
  onClose: () => void;
}

function PayModal({ order, onConfirm, onClose }: PayModalProps) {
  const [method, setMethod]   = useState<"contanti" | "carta">("contanti");
  const [felice, setFelice]   = useState(true);
  const [cash, setCash]       = useState("");
  const [quickExtras, setQuickExtras] = useState<{ label: string; price: number }[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});

  const addQuickItem = (item: typeof QUICK_ITEMS[0]) => {
    const price = parseFloat(customPrices[item.label] ?? String(item.defaultPrice));
    if (isNaN(price)) return;
    setQuickExtras(prev => [...prev, { label: item.label, price }]);
  };

  const removeQuickExtra = (idx: number) =>
    setQuickExtras(prev => prev.filter((_, i) => i !== idx));

  const quickTotal = quickExtras.reduce((s, e) => s + e.price, 0);
  const grandTotal = order.total + quickTotal;
  const change     = cash ? Math.max(0, parseFloat(cash) - grandTotal) : null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col border border-gray-600 shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-white text-xl font-bold">💳 Incassa ordine</h2>
          <p className="text-gray-400 text-sm mt-0.5">{orderTypeLabel(order)}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            Cibo: {statusLabel(order.status).label}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Dettaglio ordine */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-gray-400 text-xs font-semibold uppercase mb-2">Riepilogo ordine</p>
            <div className="space-y-1 text-sm">
              {order.items.map(i => (
                <div key={i.cartId} className="flex justify-between">
                  <span className={`flex-1 truncate ${i.id === "custom_pizza" ? "text-purple-300" : "text-gray-300"}`}>
                    {i.quantity > 1 ? `×${i.quantity} ` : ""}
                    {i.name}
                    {i.isHalf && i.halfPizza1 && i.halfPizza2 && (
                      <span className="text-purple-400 text-xs"> (½+½)</span>
                    )}
                    {i.size !== "normale" && (
                      <span className="text-yellow-500 text-xs"> [{i.size}]</span>
                    )}
                  </span>
                  <span className="text-gray-400 ml-2 shrink-0">
                    €{(i.effectivePrice * i.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {order.extras?.map((e, i) => (
                <div key={i} className="flex justify-between text-blue-300">
                  <span className="flex-1 truncate">{e.description}</span>
                  <span className="ml-2 shrink-0">€{e.price.toFixed(2)}</span>
                </div>
              ))}
              {order.type === "tavolo" && order.peopleCount && (
                <div className="flex justify-between text-gray-500">
                  <span>Coperto ({order.peopleCount} pers.)</span>
                  <span>€{order.peopleCount.toFixed(2)}</span>
                </div>
              )}
              {order.type === "delivery" && order.deliveryCost && (
                <div className="flex justify-between text-gray-500">
                  <span>Delivery</span>
                  <span>€{order.deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold pt-1 border-t border-gray-700 mt-1">
                <span>Subtotale ordine</span>
                <span>€{order.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Quick extras aggiunti */}
            {quickExtras.length > 0 && (
              <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                {quickExtras.map((e, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-orange-300 flex-1 truncate">{e.label}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-orange-400 font-semibold">€{e.price.toFixed(2)}</span>
                      <button
                        onClick={() => removeQuickExtra(i)}
                        className="text-gray-500 hover:text-red-400 text-lg leading-none w-5 h-5 flex items-center justify-center">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TOTALE FINALE */}
            <div className="flex justify-between text-orange-400 font-black text-2xl mt-3 pt-2 border-t border-gray-700">
              <span>TOTALE</span>
              <span>€{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* ── QUICK ADD AL CONTO ── */}
          <div>
            <p className="text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">
              ⚡ Aggiungi al conto
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {QUICK_ITEMS.map(qi => (
                <div key={qi.label} className="flex flex-col gap-0.5">
                  <button
                    onClick={() => addQuickItem(qi)}
                    className="bg-gray-700 hover:bg-gray-600 active:bg-orange-600/30 text-gray-200 rounded-xl py-2 px-1 text-xs font-medium text-center transition-colors leading-tight">
                    {qi.label}
                  </button>
                  <input
                    type="number" min={0} step={0.5}
                    value={customPrices[qi.label] ?? qi.defaultPrice}
                    onChange={e => setCustomPrices(prev => ({ ...prev, [qi.label]: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-300 rounded-lg px-1 py-0.5 text-xs text-center outline-none border border-gray-600"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Metodo pagamento */}
          <div>
            <p className="text-gray-300 text-sm font-semibold mb-2">Metodo di pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {(["contanti", "carta"] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    method === m
                      ? m === "contanti"
                        ? "border-green-500 bg-green-500/20 text-green-300"
                        : "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600 bg-gray-700 text-gray-400"
                  }`}>
                  {m === "contanti" ? "💵 Contanti" : "💳 Carta"}
                </button>
              ))}
            </div>
          </div>

          {/* Calcola resto (solo contanti) */}
          {method === "contanti" && (
            <div>
              <p className="text-gray-300 text-sm font-semibold mb-2">Calcola resto</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min={0} step={0.5} value={cash}
                  onChange={e => setCash(e.target.value)}
                  placeholder="Importo ricevuto €"
                  className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 text-sm"
                />
                {change !== null && (
                  <div className={`text-right shrink-0 ${change < 0 ? "text-red-400" : "text-green-400"}`}>
                    <p className="text-xs">Resto</p>
                    <p className="font-black text-xl">€{change.toFixed(2)}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[5, 10, 20, 50].map(v => (
                  <button key={v} onClick={() => setCash(String(v))}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2.5 py-1 rounded-lg border border-gray-600 transition-colors">
                    €{v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opzione Felice — mascherata */}
          <button
            onClick={() => setFelice(f => !f)}
            className={`w-full py-2 rounded-xl text-sm border transition-all ${
              felice
                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                : "border-gray-700 bg-gray-700/30 text-gray-500"
            }`}>
            {felice ? "😊 Felice" : "😐 Non felice"}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition-colors">
            Annulla
          </button>
          <button onClick={() => onConfirm(method, felice, quickExtras)}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
            ✅ Incassa €{grandTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// COMPONENTE PRINCIPALE CASSA
// ─────────────────────────────────────────
export default function CassaZone() {
  const { loading }                             = useAuth();
  const [orders, setOrders]                     = useState<Order[]>([]);
  const [payingOrder, setPayingOrder]           = useState<Order | null>(null);
  const [tab, setTab]                           = useState<"daPagare" | "pagati">("daPagare");
  const [confirmDelete, setConfirmDelete]       = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert]       = useState<string | null>(null);

  useEffect(() => {
    return subscribeToOrdersToday(setOrders);
  }, []);

  const handlePay = async (
    method: "contanti" | "carta",
    felice: boolean,
    quickExtras: { label: string; price: number }[]
  ) => {
    if (!payingOrder) return;

    // Se ci sono quick extras, aggiorna il totale prima di pagare
    if (quickExtras.length > 0) {
      const extraTotal = quickExtras.reduce((s, e) => s + e.price, 0);
      const newExtras  = [
        ...(payingOrder.extras ?? []),
        ...quickExtras.map(e => ({ description: e.label, price: e.price })),
      ];
      await updateOrder(payingOrder.id, {
        extras: newExtras,
        total:  payingOrder.total + extraTotal,
      });
    }

    await payOrder(payingOrder.id, { paymentMethod: method, felice });
    setPayingOrder(null);
  };

  const handleRevertPayment = async (orderId: string) => {
    await revertPayment(orderId);
    setConfirmRevert(null);
  };

  const handleCancelOrder = async (orderId: string) => {
    await cancelOrder(orderId);
    setConfirmDelete(null);
  };

  const daPagare  = orders.filter(o => !o.isPaid);
  const pagati    = orders.filter(o => o.isPaid);
  const displayed = tab === "daPagare" ? daPagare : pagati;

  const totaleDaPagare  = daPagare.reduce((s, o) => s + o.total, 0);
  const totaleIncassato = pagati.reduce((s, o) => s + o.total, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-white">Caricamento...</p>
    </div>
  );

  return (
    <>
      {payingOrder && (
        <PayModal
          order={payingOrder}
          onConfirm={handlePay}
          onClose={() => setPayingOrder(null)}
        />
      )}

      <div className="h-[calc(100vh-80px)] flex flex-col gap-4 overflow-hidden">

        {/* Header con totali */}
        <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
          <h1 className="text-white text-2xl font-bold">💳 Cassa</h1>
          <div className="flex gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-right">
              <p className="text-gray-400 text-xs">Da incassare</p>
              <p className="text-orange-400 text-2xl font-black">€{totaleDaPagare.toFixed(2)}</p>
              <p className="text-gray-500 text-xs">{daPagare.length} ordini</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-right">
              <p className="text-gray-400 text-xs">Incassato oggi</p>
              <p className="text-green-400 text-2xl font-black">€{totaleIncassato.toFixed(2)}</p>
              <p className="text-gray-500 text-xs">{pagati.length} ordini</p>
            </div>
          </div>
        </div>

        {/* Tab */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setTab("daPagare")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border ${
              tab === "daPagare"
                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                : "border-gray-700 bg-gray-800 text-gray-400"
            }`}>
            💰 Da pagare ({daPagare.length})
          </button>
          <button
            onClick={() => setTab("pagati")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border ${
              tab === "pagati"
                ? "border-green-500 bg-green-500/20 text-green-300"
                : "border-gray-700 bg-gray-800 text-gray-400"
            }`}>
            ✅ Già pagati ({pagati.length})
          </button>
        </div>

        {/* Lista ordini */}
        {displayed.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <p className="text-5xl mb-3">{tab === "daPagare" ? "🎉" : "📋"}</p>
            <p className="text-lg font-medium">
              {tab === "daPagare" ? "Nessun ordine da pagare!" : "Nessun ordine pagato oggi"}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start pr-1">
            {displayed.map(order => {
              const st         = statusLabel(order.status);
              const isDeleting = confirmDelete === order.id;
              const isReverting = confirmRevert === order.id;

              return (
                <div key={order.id}
                  className={`bg-gray-800 rounded-2xl border p-4 flex flex-col gap-3 ${
                    order.isPaid      ? "border-green-700/50" :
                    order.status === "consegnato" ? "border-blue-700" :
                    order.status === "pronto"     ? "border-orange-600" :
                                                    "border-gray-700"
                  }`}>

                  {/* Header card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold">{orderTypeLabel(order)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">🕐 {formatTime(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${st.color}`}>
                        {st.label}
                      </span>
                      {order.isPaid && (
                        <span className="text-xs bg-green-700 text-green-100 px-2 py-0.5 rounded-lg font-bold">
                          ✅ PAGATO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Prodotti */}
                  <div className="space-y-1">
                    {order.items.map(item => (
                      <div key={item.cartId} className="flex justify-between text-sm">
                        <span className={`flex-1 truncate ${item.id === "custom_pizza" ? "text-purple-300" : "text-gray-300"}`}>
                          {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                          {item.name}
                          {item.isHalf && item.halfPizza1 && item.halfPizza2 && (
                            <span className="text-purple-400 text-xs"> (½+½)</span>
                          )}
                          {item.size !== "normale" && (
                            <span className="text-yellow-500 text-xs"> [{item.size}]</span>
                          )}
                          {item.manualAdditions?.length > 0 && (
                            <span className="text-orange-400 text-xs"> +{item.manualAdditions.map(m => m.name).join(", ")}</span>
                          )}
                        </span>
                        <span className="text-gray-400 ml-2 shrink-0">
                          €{(item.effectivePrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {order.extras?.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-blue-300 flex-1 truncate">{e.description}</span>
                        <span className="text-blue-300 ml-2 shrink-0">€{e.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {order.type === "tavolo" && order.peopleCount && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Coperto</span>
                        <span>€{order.peopleCount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.type === "delivery" && order.deliveryCost && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Delivery</span>
                        <span>€{order.deliveryCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  {order.orderNotes && (
                    <p className="text-yellow-300 text-xs bg-yellow-500/10 rounded-lg px-2 py-1.5">
                      📋 {order.orderNotes}
                    </p>
                  )}

                  {/* Totale + azione principale */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700 mt-auto">
                    <span className="text-orange-400 text-2xl font-black">
                      €{order.total.toFixed(2)}
                    </span>
                    {order.isPaid ? (
                      <div className="text-right">
                        <p className="text-green-400 text-sm font-bold">
                          {order.paymentMethod === "contanti" ? "💵 Contanti" : "💳 Carta"}
                        </p>
                        {order.paidAt && (
                          <p className="text-gray-500 text-xs">{formatTime(order.paidAt)}</p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setPayingOrder(order)}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl transition-colors text-sm">
                        💰 Incassa
                      </button>
                    )}
                  </div>

                  {/* ── Annulla pagamento (solo ordini pagati) ── */}
                  {order.isPaid && (
                    <div>
                      {isReverting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRevertPayment(order.id)}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-2 rounded-xl transition-colors">
                            ↩ Sì, annulla pagamento
                          </button>
                          <button
                            onClick={() => setConfirmRevert(null)}
                            className="flex-1 bg-gray-700 text-gray-300 text-xs py-2 rounded-xl transition-colors">
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevert(order.id)}
                          className="w-full bg-gray-700/50 hover:bg-yellow-900/30 text-gray-400 hover:text-yellow-300 text-xs py-2 rounded-xl transition-colors border border-gray-700 hover:border-yellow-700/50">
                          ↩ Annulla pagamento
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Elimina ordine (tutti) ── */}
                  {isDeleting ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded-xl transition-colors">
                        🗑 Sì, elimina
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 bg-gray-700 text-gray-300 text-xs py-2 rounded-xl transition-colors">
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(order.id)}
                      className="w-full text-gray-600 hover:text-red-400 text-xs py-1 transition-colors hover:bg-red-900/10 rounded-lg">
                      🗑 Elimina ordine
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
