"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, payOrder } from "@/lib/orders";
import { Order } from "@/types";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const orderTypeLabel = (order: Order) => {
  if (order.type === "tavolo")  return `🪑 Tavolo ${order.tableNumber} (${order.peopleCount} pers.)`;
  if (order.type === "asporto") return `🥡 ${order.customerName || "Asporto"}`;
  return `🚴 ${order.customerName || order.deliveryAddress || "Delivery"}`;
};

const statusLabel = (s: string) => {
  switch(s) {
    case "attesa":       return { label: "⏳ In attesa",   color: "bg-gray-600 text-gray-200" };
    case "preparazione": return { label: "🔧 In prep.",    color: "bg-yellow-600 text-yellow-100" };
    case "pronto":       return { label: "🔧 Rifinitura",  color: "bg-orange-600 text-orange-100" };
    case "consegnato":   return { label: "✅ Consegnato",  color: "bg-blue-600 text-blue-100" };
    default:             return { label: s,                color: "bg-gray-600 text-gray-200" };
  }
};

interface PayModalProps {
  order: Order;
  onConfirm: (method: "contanti" | "carta", felice: boolean) => void;
  onClose: () => void;
}

function PayModal({ order, onConfirm, onClose }: PayModalProps) {
  const [method, setMethod] = useState<"contanti" | "carta">("contanti");
  const [felice, setFelice] = useState(true);
  const [cash, setCash]     = useState("");
  const change = cash ? Math.max(0, parseFloat(cash) - order.total) : null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-sm border border-gray-600 shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-gray-700">
          <h2 className="text-white text-xl font-bold">💳 Incassa ordine</h2>
          <p className="text-gray-400 text-sm mt-1">{orderTypeLabel(order)}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            Status cibo: {statusLabel(order.status).label}
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* Totale */}
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Totale da pagare</p>
            <p className="text-orange-400 text-5xl font-black">€{order.total.toFixed(2)}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              {order.items.map(i => (
                <div key={i.cartId} className="flex justify-between px-2">
                  <span>{i.quantity > 1 ? `×${i.quantity} ` : ""}{i.name}{i.size !== "normale" ? ` [${i.size}]` : ""}</span>
                  <span>€{(i.effectivePrice * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              {order.extras?.map((e, i) => (
                <div key={i} className="flex justify-between px-2 text-blue-400">
                  <span>{e.description}</span><span>€{e.price.toFixed(2)}</span>
                </div>
              ))}
              {order.type === "tavolo" && order.peopleCount && (
                <div className="flex justify-between px-2">
                  <span>Coperto ({order.peopleCount} pers.)</span>
                  <span>€{order.peopleCount.toFixed(2)}</span>
                </div>
              )}
              {order.type === "delivery" && order.deliveryCost && (
                <div className="flex justify-between px-2">
                  <span>Delivery</span><span>€{order.deliveryCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Metodo */}
          <div>
            <p className="text-gray-300 text-sm font-semibold mb-2">Metodo di pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {(["contanti", "carta"] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    method === m
                      ? m === "contanti" ? "border-green-500 bg-green-500/20 text-green-300" : "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600 bg-gray-700 text-gray-400"
                  }`}>
                  {m === "contanti" ? "💵 Contanti" : "💳 Carta"}
                </button>
              ))}
            </div>
          </div>

          {/* Calcola resto */}
          {method === "contanti" && (
            <div>
              <p className="text-gray-300 text-sm font-semibold mb-2">Calcola resto</p>
              <div className="flex gap-2 items-center">
                <input type="number" min={0} step={0.5} value={cash}
                  onChange={e => setCash(e.target.value)}
                  placeholder="Importo ricevuto €"
                  className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 text-sm" />
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

          {/* Felice — mascherato */}
          <button onClick={() => setFelice(f => !f)}
            className={`w-full py-2 rounded-xl text-sm border transition-all ${
              felice
                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                : "border-gray-700 bg-gray-700/30 text-gray-500"
            }`}>
            {felice ? "😊 Felice" : "😐 Non felice"}
          </button>
        </div>

        <div className="p-5 border-t border-gray-700 flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition-colors">
            Annulla
          </button>
          <button onClick={() => onConfirm(method, felice)}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
            ✅ Incassa
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CassaZone() {
  const { loading }                           = useAuth();
  const [orders, setOrders]                   = useState<Order[]>([]);
  const [payingOrder, setPayingOrder]         = useState<Order | null>(null);
  const [tab, setTab]                         = useState<"daPagare" | "pagati">("daPagare");

  useEffect(() => {
    return subscribeToOrdersToday(setOrders);
  }, []);

  const handlePay = async (method: "contanti" | "carta", felice: boolean) => {
    if (!payingOrder) return;
    await payOrder(payingOrder.id, { paymentMethod: method, felice });
    setPayingOrder(null);
  };

  const daPagare  = orders.filter(o => !o.isPaid);
  const pagati    = orders.filter(o => o.isPaid);
  const displayed = tab === "daPagare" ? daPagare : pagati;

  const totaleDaPagare  = daPagare.reduce((s, o) => s + o.total, 0);
  const totaleIncassato = pagati.reduce((s, o) => s + o.total, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  return (
    <>
      {payingOrder && (
        <PayModal order={payingOrder} onConfirm={handlePay} onClose={() => setPayingOrder(null)} />
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
          <button onClick={() => setTab("daPagare")}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors border ${
              tab === "daPagare"
                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                : "border-gray-700 bg-gray-800 text-gray-400"
            }`}>
            💰 Da pagare ({daPagare.length})
          </button>
          <button onClick={() => setTab("pagati")}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors border ${
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
              const st = statusLabel(order.status);
              return (
                <div key={order.id}
                  className={`bg-gray-800 rounded-2xl border p-4 flex flex-col gap-3 ${
                    order.isPaid ? "border-green-700/50" :
                    order.status === "consegnato" ? "border-blue-700" :
                    order.status === "pronto"     ? "border-orange-600" : "border-gray-700"
                  }`}>

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold">{orderTypeLabel(order)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">🕐 {formatTime(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${st.color}`}>
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
                        <span className="text-gray-300 truncate">
                          {item.quantity > 1 && <span className="text-orange-400">×{item.quantity} </span>}
                          {item.name}
                          {item.size !== "normale" && <span className="text-yellow-500 text-xs"> [{item.size}]</span>}
                        </span>
                        <span className="text-gray-400 shrink-0 ml-2">€{(item.effectivePrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {order.extras?.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-blue-300">{e.description}</span>
                        <span className="text-blue-300 shrink-0 ml-2">€{e.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {order.type === "tavolo" && order.peopleCount && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Coperto</span><span>€{order.peopleCount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.type === "delivery" && order.deliveryCost && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Delivery</span><span>€{order.deliveryCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {order.orderNotes && (
                    <p className="text-yellow-300 text-xs bg-yellow-500/10 rounded-lg px-2 py-1.5">📋 {order.orderNotes}</p>
                  )}

                  {/* Totale + azione */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700 mt-auto">
                    <span className="text-orange-400 text-2xl font-black">€{order.total.toFixed(2)}</span>
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
                      <button onClick={() => setPayingOrder(order)}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl transition-colors text-sm">
                        💰 Incassa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}