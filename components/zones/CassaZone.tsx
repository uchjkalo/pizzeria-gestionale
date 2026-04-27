"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrdersToday, payOrder, updateOrder, revertPayment, cancelOrder } from "@/lib/orders";
import { Order, OrderItem } from "@/types";

const formatTime = (date: Date) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const orderTypeLabel = (order: Order) => {
  if (order.type === "tavolo")  return `🪑 Tavolo ${order.tableNumber} (${order.peopleCount} pers.)`;
  if (order.type === "asporto") return `🥡 ${order.customerName || "Asporto"}`;
  return `🚴 ${order.customerName || order.deliveryAddress || "Delivery"}`;
};

const statusLabel = (s: string) => {
  switch (s) {
    case "attesa":       return { label: "⏳ In attesa",  color: "bg-gray-600 text-gray-200" };
    case "preparazione": return { label: "🔧 In prep.",   color: "bg-yellow-600 text-yellow-100" };
    case "pronto":       return { label: "🔧 Rifinitura", color: "bg-orange-600 text-orange-100" };
    case "consegnato":   return { label: "✅ Consegnato", color: "bg-blue-600 text-blue-100" };
    default:             return { label: s,               color: "bg-gray-600 text-gray-200" };
  }
};

/* ─────────────────────────────────────────
   TIPI
───────────────────────────────────────── */
interface QuickExtra {
  id: string;          // uuid locale per rimozione
  label: string;
  price: number;
}

/* ─────────────────────────────────────────
   MAPPA CATEGORIA → ETICHETTA SCONTRINO
───────────────────────────────────────── */
const CATEGORY_LABEL: Record<string, string> = {
  pizze: "Pizza", panini: "Panino", burger: "Burger",
  fritti: "Fritti", bibite: "Bibita", specialita: "Specialità",
};

/* ─────────────────────────────────────────
   RIEPILOGO RECEIPT LINES
   Una riga per unità (qty 3 pizza → 3 righe)
───────────────────────────────────────── */
interface ReceiptLine {
  key: string; label: string; detail: string; price: number; dim?: string; isPostOrder?: boolean;
}

function buildReceiptLines(order: Order, quickExtras: QuickExtra[]): ReceiptLine[] {
  const lines: ReceiptLine[] = [];

  order.items.forEach((item: OrderItem) => {
    const catLabel = CATEGORY_LABEL[item.category] ?? item.category;
    let namePart = item.name;
    if (item.isHalf && item.halfPizza1 && item.halfPizza2)
      namePart = `½ ${item.halfPizza1.name} + ½ ${item.halfPizza2.name}`;
    const dimLabel = item.size !== "normale" ? item.size.toUpperCase() : "";
    for (let i = 0; i < item.quantity; i++) {
      lines.push({ key: `${item.cartId}_${i}`, label: catLabel, detail: namePart, price: item.effectivePrice, dim: dimLabel || undefined });
    }
  });

  if (order.type === "tavolo" && order.peopleCount) {
    for (let i = 0; i < order.peopleCount; i++)
      lines.push({ key: `coperto_${i}`, label: "Portata", detail: "", price: 1 });
  }
  if (order.type === "delivery" && order.deliveryCost)
    lines.push({ key: "delivery", label: "Delivery", detail: order.deliveryAddress ?? "", price: order.deliveryCost });

  (order.extras ?? []).forEach((e, i) =>
    lines.push({ key: `extra_${i}`, label: e.description, detail: "", price: e.price }));

  quickExtras.forEach(e =>
    lines.push({ key: `qex_${e.id}`, label: e.label, detail: "", price: e.price, isPostOrder: true }));

  return lines;
}

/* ─────────────────────────────────────────
   QUICK ITEMS predefiniti
───────────────────────────────────────── */
const QUICK_ITEMS = [
  { emoji: "🍕", label: "Pizza",      price: 8.00  },
  { emoji: "🥪", label: "Panino",     price: 9.00  },
  { emoji: "🍔", label: "Burger",     price: 11.00 },
  { emoji: "🍟", label: "Fritti",     price: 3.50  },
  { emoji: "🥤", label: "Bibita",     price: 3.00  },
  { emoji: "💧", label: "Acqua",      price: 1.50  },
  { emoji: "🍺", label: "Birra",      price: 3.50  },
  { emoji: "🍷", label: "Vino",       price: 3.00  },
  { emoji: "☕", label: "Caffè",      price: 1.50  },
  { emoji: "🍰", label: "Dolce",      price: 4.00  },
  { emoji: "🚴", label: "Delivery",   price: 2.00  },
  { emoji: "🪑", label: "Portata",    price: 1.00  },
  { emoji: "⭐", label: "Specialità", price: 12.00 },
  { emoji: "➕", label: "Aggiunta",   price: 1.00  },
];

/* ─────────────────────────────────────────
   PAY MODAL
───────────────────────────────────────── */
interface PayModalProps {
  order: Order;
  initialQuickExtras: QuickExtra[];
  onConfirm: (method: "contanti" | "carta", felice: boolean, extras: QuickExtra[]) => void;
  onClose: (currentExtras: QuickExtra[]) => void;  // salva lo stato anche se non si conferma
}

function PayModal({ order, initialQuickExtras, onConfirm, onClose }: PayModalProps) {
  const [method, setMethod]       = useState<"contanti" | "carta">("contanti");
  const [felice, setFelice]       = useState(true);
  const [cash, setCash]           = useState("");
  const [quickExtras, setQuickExtras] = useState<QuickExtra[]>(initialQuickExtras);
  // prezzi custom per i quick item predefiniti
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  // aggiunta personalizzata (solo prezzo)
  const [customPrice, setCustomPrice]   = useState("");
  const [customLabel, setCustomLabel]   = useState("");
  // view: "riepilogo" | "aggiunte" | "pagamento"
  const [view, setView] = useState<"riepilogo" | "aggiunte" | "pagamento">("riepilogo");

  const uid = () => Math.random().toString(36).slice(2, 9);

  const addQuickItem = (item: typeof QUICK_ITEMS[0]) => {
    const price = parseFloat(customPrices[item.label] ?? String(item.price));
    if (isNaN(price) || price <= 0) return;
    setQuickExtras(prev => [...prev, { id: uid(), label: `${item.emoji} ${item.label}`, price }]);
  };

  const addCustom = () => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) return;
    setQuickExtras(prev => [...prev, { id: uid(), label: customLabel.trim() || "➕ Extra", price }]);
    setCustomPrice(""); setCustomLabel("");
  };

  const removeQuickExtra = (id: string) =>
    setQuickExtras(prev => prev.filter(e => e.id !== id));

  const receiptLines = buildReceiptLines(order, quickExtras);
  const grandTotal   = receiptLines.reduce((s, l) => s + l.price, 0);
  const change       = cash ? Math.max(0, parseFloat(cash) - grandTotal) : null;
  const postOrderCount = quickExtras.length;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={() => onClose(quickExtras)}>
      <div className="bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full max-w-md flex flex-col border-t sm:border border-gray-700/50 shadow-2xl"
        style={{ maxHeight: "calc(100dvh - 56px)" }}
        onClick={e => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-700/40 shrink-0 flex items-start justify-between">
          <div>
            <h2 className="text-white text-lg font-bold">💳 Cassa — {orderTypeLabel(order)}</h2>
            <p className="text-gray-500 text-xs mt-0.5">Cibo: {statusLabel(order.status).label}</p>
          </div>
          <button onClick={() => onClose(quickExtras)}
            className="w-11 h-11 bg-gray-800 active:bg-gray-700 text-gray-400 rounded-2xl flex items-center justify-center text-2xl font-bold ml-2 shrink-0">
            ×
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 px-3 pt-2 shrink-0">
          {([
            { key: "riepilogo", label: "🧾 Conto" },
            { key: "aggiunte",  label: `➕ Aggiunte${postOrderCount > 0 ? ` (${postOrderCount})` : ""}` },
            { key: "pagamento", label: "💳 Paga" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                view === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-gray-800 text-gray-500 border border-gray-700/40"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body scrollabile */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ── TAB RIEPILOGO ── */}
          {view === "riepilogo" && (
            <div className="p-4 space-y-3">
              <div className="bg-gray-800/60 rounded-2xl px-4 py-3 space-y-2">
                {/* Righe ordine normale */}
                {buildReceiptLines(order, []).map(line => (
                  <div key={line.key} className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                      <span className="text-gray-600 text-[10px] font-mono shrink-0">1×</span>
                      <span className="text-gray-200 text-sm font-semibold shrink-0">{line.label}</span>
                      {line.dim && <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1 rounded shrink-0">{line.dim}</span>}
                      {line.detail && <span className="text-gray-500 text-xs truncate">({line.detail})</span>}
                    </div>
                    <span className="text-gray-300 text-sm font-mono shrink-0 tabular-nums">€{line.price.toFixed(2)}</span>
                  </div>
                ))}

                {/* Aggiunte post-ordine */}
                {quickExtras.length > 0 && (
                  <>
                    <div className="border-t border-dashed border-gray-700 mt-2 pt-2">
                      <p className="text-[9px] uppercase tracking-widest text-orange-400/70 font-bold mb-2">Aggiunte post-ordine</p>
                      {quickExtras.map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-orange-500 text-[10px] font-mono shrink-0">1×</span>
                            <span className="text-orange-300 text-sm font-semibold truncate">{e.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-orange-300 text-sm font-mono tabular-nums">€{e.price.toFixed(2)}</span>
                            <button onClick={() => removeQuickExtra(e.id)}
                              className="w-7 h-7 bg-gray-700 hover:bg-red-600/40 text-gray-500 hover:text-red-400 rounded-lg flex items-center justify-center text-base transition-all">
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Totale */}
                <div className="border-t border-dashed border-gray-700 mt-2 pt-3 flex justify-between items-baseline">
                  <span className="text-gray-500 text-xs uppercase tracking-widest">Totale</span>
                  <span className="text-orange-400 font-black text-2xl tabular-nums">€{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {order.orderNotes && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                  <p className="text-yellow-300 text-xs">📋 {order.orderNotes}</p>
                </div>
              )}

              <button onClick={() => setView("aggiunte")}
                className="w-full bg-gray-800 border border-gray-700/40 text-gray-300 text-sm py-3 rounded-2xl font-semibold">
                ➕ Aggiungi al conto
              </button>
              <button onClick={() => setView("pagamento")}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-4 rounded-2xl text-sm shadow-[0_4px_16px_rgba(34,197,94,0.3)]">
                💳 Procedi al pagamento — €{grandTotal.toFixed(2)}
              </button>
            </div>
          )}

          {/* ── TAB AGGIUNTE ── */}
          {view === "aggiunte" && (
            <div className="p-4 space-y-4">

              {/* Aggiunte rapide */}
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3">Rapide</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_ITEMS.map(qi => (
                    <div key={qi.label} className="flex flex-col gap-1">
                      <button onClick={() => addQuickItem(qi)}
                        className="bg-gray-800 active:bg-orange-500/20 border border-gray-700/40 text-gray-200 rounded-xl py-2.5 text-xs font-semibold text-center transition-all">
                        <div className="text-lg mb-0.5">{qi.emoji}</div>
                        {qi.label}
                      </button>
                      <div className="flex items-center bg-gray-800 border border-gray-700/40 rounded-lg px-1.5 py-1 gap-1">
                        <span className="text-gray-600 text-[10px]">€</span>
                        <input type="number" min={0} step={0.5}
                          value={customPrices[qi.label] ?? qi.price}
                          onChange={e => setCustomPrices(prev => ({ ...prev, [qi.label]: e.target.value }))}
                          className="w-full bg-transparent text-gray-300 text-xs text-center outline-none tabular-nums" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aggiunta personalizzata */}
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Personalizzata</p>
                <div className="bg-gray-800/60 border border-gray-700/40 rounded-2xl p-3 space-y-2">
                  <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                    placeholder="Descrizione (opzionale)"
                    className="w-full bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-gray-700/60 focus:ring-orange-500/50 placeholder:text-gray-700" />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-bold">€</span>
                      <input type="number" min={0} step={0.5} value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addCustom()}
                        placeholder="0.00"
                        className="w-full bg-gray-900 text-white rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none ring-1 ring-gray-700/60 focus:ring-orange-500/50 placeholder:text-gray-700 tabular-nums" />
                    </div>
                    <button onClick={addCustom}
                      className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-4 font-bold text-lg transition-colors">
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Elenco aggiunte effettuate */}
              {quickExtras.length > 0 && (
                <div>
                  <p className="text-orange-400/80 text-[10px] uppercase tracking-widest font-bold mb-2">Aggiunte post-ordine</p>
                  <div className="space-y-1.5">
                    {quickExtras.map(e => (
                      <div key={e.id} className="flex items-center justify-between bg-orange-500/5 border border-orange-500/20 rounded-xl px-3 py-2.5">
                        <span className="text-orange-300 text-sm font-semibold">{e.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400 font-bold tabular-nums">€{e.price.toFixed(2)}</span>
                          <button onClick={() => removeQuickExtra(e.id)}
                            className="w-8 h-8 bg-gray-800 active:bg-red-600/40 text-gray-500 rounded-xl flex items-center justify-center text-lg transition-all">
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs text-orange-400/70 px-1 pt-1">
                      <span>Subtotale aggiunte</span>
                      <span className="font-bold tabular-nums">+€{quickExtras.reduce((s, e) => s + e.price, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={() => setView("riepilogo")}
                className="w-full bg-gray-800 border border-gray-700/40 text-gray-300 py-3 rounded-2xl text-sm font-semibold">
                ← Torna al conto (€{grandTotal.toFixed(2)})
              </button>
            </div>
          )}

          {/* ── TAB PAGAMENTO ── */}
          {view === "pagamento" && (
            <div className="p-4 space-y-4">
              {/* Totale recap */}
              <div className="bg-gray-800/60 border border-gray-700/40 rounded-2xl px-4 py-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Da incassare</span>
                <span className="text-orange-400 font-black text-3xl tabular-nums">€{grandTotal.toFixed(2)}</span>
              </div>

              {/* Metodo */}
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Metodo</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["contanti", "carta"] as const).map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`py-4 rounded-2xl font-bold text-sm border-2 transition-all ${
                        method === m
                          ? m === "contanti" ? "border-green-500 bg-green-500/15 text-green-300" : "border-blue-500 bg-blue-500/15 text-blue-300"
                          : "border-gray-700 bg-gray-800 text-gray-500"
                      }`}>
                      <div className="text-2xl mb-1">{m === "contanti" ? "💵" : "💳"}</div>
                      {m === "contanti" ? "Contanti" : "Carta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calcola resto */}
              {method === "contanti" && (
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Calcola resto</p>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold">€</span>
                      <input type="number" min={0} step={0.5} value={cash}
                        onChange={e => setCash(e.target.value)} placeholder="Importo ricevuto"
                        className="w-full bg-gray-800 text-white rounded-xl pl-7 pr-3 py-3 outline-none ring-1 ring-gray-700/60 focus:ring-green-500/50 text-sm" />
                    </div>
                    {change !== null && (
                      <div className={`text-right shrink-0 ${change < 0 ? "text-red-400" : "text-green-400"}`}>
                        <p className="text-[10px] uppercase tracking-wider">Resto</p>
                        <p className="font-black text-xl tabular-nums">€{change.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 20, 50].map(v => (
                      <button key={v} onClick={() => setCash(String(v))}
                        className="flex-1 bg-gray-800 border border-gray-700/40 text-gray-300 text-sm py-2 rounded-xl font-semibold">
                        €{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Felice */}
              <button onClick={() => setFelice(f => !f)}
                className={`w-full py-2.5 rounded-xl text-sm border transition-all ${
                  felice ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" : "border-gray-700 bg-gray-800 text-gray-500"
                }`}>
                {felice ? "😊 Con scontrino" : "😐 Senza scontrino"}
              </button>
            </div>
          )}
        </div>

        {/* Footer sticky con incassa */}
        {view === "pagamento" && (
          <div className="border-t border-gray-700/40 p-4 shrink-0 space-y-2 bg-gray-900">
            <button onClick={() => onConfirm(method, felice, quickExtras)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black py-4 rounded-2xl text-base shadow-[0_4px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-all">
              ✅ Incassa €{grandTotal.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CASSA ZONE
───────────────────────────────────────── */
export default function CassaZone() {
  const { loading }                         = useAuth();
  const [orders, setOrders]                 = useState<Order[]>([]);
  const [payingOrderId, setPayingOrderId]   = useState<string | null>(null);
  const [tab, setTab]                       = useState<"daPagare" | "pagati">("daPagare");
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert]   = useState<string | null>(null);
  // Persistenza aggiunte rapide per ordine: { [orderId]: QuickExtra[] }
  const [savedExtras, setSavedExtras]       = useState<Record<string, QuickExtra[]>>({});

  useEffect(() => { return subscribeToOrdersToday(setOrders); }, []);

  const payingOrder = orders.find(o => o.id === payingOrderId) ?? null;

  const handlePay = async (method: "contanti" | "carta", felice: boolean, extras: QuickExtra[]) => {
    if (!payingOrder) return;
    if (extras.length > 0) {
      const extraTotal = extras.reduce((s, e) => s + e.price, 0);
      await updateOrder(payingOrder.id, {
        extras: [...(payingOrder.extras ?? []), ...extras.map(e => ({ description: e.label, price: e.price }))],
        total:  payingOrder.total + extraTotal,
      });
    }
    await payOrder(payingOrder.id, { paymentMethod: method, felice });
    // Pulisce le aggiunte salvate dopo il pagamento
    setSavedExtras(prev => { const n = { ...prev }; delete n[payingOrder.id]; return n; });
    setPayingOrderId(null);
  };

  const handleModalClose = (orderId: string, currentExtras: QuickExtra[]) => {
    // Salva le aggiunte anche se non si conferma il pagamento
    setSavedExtras(prev => ({ ...prev, [orderId]: currentExtras }));
    setPayingOrderId(null);
  };

  const handleRevertPayment = async (orderId: string) => { await revertPayment(orderId); setConfirmRevert(null); };
  const handleCancelOrder   = async (orderId: string) => { await cancelOrder(orderId); setConfirmDelete(null); };

  const daPagare  = orders.filter(o => !o.isPaid);
  const pagati    = orders.filter(o => o.isPaid);
  const displayed = tab === "daPagare" ? daPagare : pagati;

  const totaleDaPagare  = daPagare.reduce((s, o) => s + o.total, 0);
  const totaleIncassato = pagati.reduce((s, o) => s + o.total, 0);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-white">Caricamento...</p></div>;

  return (
    <>
      {payingOrder && (
        <PayModal
          order={payingOrder}
          initialQuickExtras={savedExtras[payingOrder.id] ?? []}
          onConfirm={handlePay}
          onClose={(extras) => handleModalClose(payingOrder.id, extras)}
        />
      )}

      <div className="h-[calc(100vh-80px)] flex flex-col gap-3 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
          <h1 className="text-white text-xl font-bold">💳 Cassa</h1>
          <div className="flex gap-2">
            <div className="bg-gray-800 border border-gray-700/50 rounded-2xl px-4 py-2 text-right">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Da incassare</p>
              <p className="text-orange-400 text-xl font-black tabular-nums">€{totaleDaPagare.toFixed(2)}</p>
              <p className="text-gray-600 text-[10px]">{daPagare.length} ordini</p>
            </div>
            <div className="bg-gray-800 border border-gray-700/50 rounded-2xl px-4 py-2 text-right">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Incassato</p>
              <p className="text-green-400 text-xl font-black tabular-nums">€{totaleIncassato.toFixed(2)}</p>
              <p className="text-gray-600 text-[10px]">{pagati.length} ordini</p>
            </div>
          </div>
        </div>

        {/* Tab */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setTab("daPagare")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border ${tab === "daPagare" ? "border-orange-500 bg-orange-500/20 text-orange-300" : "border-gray-700 bg-gray-800 text-gray-500"}`}>
            💰 Da pagare ({daPagare.length})
          </button>
          <button onClick={() => setTab("pagati")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border ${tab === "pagati" ? "border-green-500 bg-green-500/20 text-green-300" : "border-gray-700 bg-gray-800 text-gray-500"}`}>
            ✅ Pagati ({pagati.length})
          </button>
        </div>

        {/* Lista */}
        {displayed.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <p className="text-5xl mb-3">{tab === "daPagare" ? "🎉" : "📋"}</p>
            <p className="font-medium">{tab === "daPagare" ? "Nessun ordine da pagare!" : "Nessun ordine pagato oggi"}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start pb-4">
            {displayed.map(order => {
              const st          = statusLabel(order.status);
              const isDeleting  = confirmDelete === order.id;
              const isReverting = confirmRevert === order.id;
              const hasSavedExtras = (savedExtras[order.id]?.length ?? 0) > 0;
              const cardLines   = buildReceiptLines(order, savedExtras[order.id] ?? []);
              const cardTotal   = cardLines.reduce((s, l) => s + l.price, 0);

              return (
                <div key={order.id}
                  className={`bg-gray-800 rounded-2xl border p-4 flex flex-col gap-3 ${
                    order.isPaid ? "border-green-700/50" :
                    order.status === "pronto" ? "border-orange-600" :
                    hasSavedExtras ? "border-orange-500/40" : "border-gray-700/50"
                  }`}>

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">{orderTypeLabel(order)}</p>
                      <p className="text-gray-600 text-xs mt-0.5">🕐 {formatTime(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${st.color}`}>{st.label}</span>
                      {order.isPaid && <span className="text-xs bg-green-700 text-green-100 px-2 py-0.5 rounded-lg font-bold">✅ PAGATO</span>}
                      {hasSavedExtras && !order.isPaid && (
                        <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-lg font-bold">
                          +{savedExtras[order.id]!.length} extra
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Receipt compatto */}
                  <div className="bg-gray-900/60 rounded-xl px-3 py-2.5 space-y-1.5">
                    {/* Righe ordine */}
                    {buildReceiptLines(order, []).map(line => (
                      <div key={line.key} className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                          <span className="text-gray-700 text-[10px] font-mono shrink-0">1×</span>
                          <span className="text-gray-300 text-xs font-semibold shrink-0">{line.label}</span>
                          {line.dim && <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1 rounded shrink-0">{line.dim}</span>}
                          {line.detail && <span className="text-gray-600 text-[10px] truncate">({line.detail})</span>}
                        </div>
                        <span className="text-gray-500 text-xs font-mono shrink-0 tabular-nums">€{line.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {/* Aggiunte post-ordine */}
                    {(savedExtras[order.id]?.length ?? 0) > 0 && (
                      <div className="border-t border-dashed border-gray-700/60 pt-1.5 mt-1">
                        <p className="text-[9px] text-orange-400/60 uppercase tracking-widest font-bold mb-1">Post-ordine</p>
                        {savedExtras[order.id]!.map(e => (
                          <div key={e.id} className="flex items-baseline justify-between gap-2">
                            <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                              <span className="text-orange-500/60 text-[10px] font-mono shrink-0">1×</span>
                              <span className="text-orange-300/80 text-xs truncate">{e.label}</span>
                            </div>
                            <span className="text-orange-300/80 text-xs font-mono tabular-nums shrink-0">€{e.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {order.orderNotes && (
                    <p className="text-yellow-300 text-xs bg-yellow-500/10 rounded-lg px-2 py-1.5">📋 {order.orderNotes}</p>
                  )}

                  {/* Totale + azione */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700/40 mt-auto">
                    <span className="text-orange-400 text-2xl font-black tabular-nums">€{cardTotal.toFixed(2)}</span>
                    {order.isPaid ? (
                      <div className="text-right">
                        <p className="text-green-400 text-sm font-bold">{order.paymentMethod === "contanti" ? "💵 Contanti" : "💳 Carta"}</p>
                        {order.paidAt && <p className="text-gray-600 text-xs">{formatTime(order.paidAt)}</p>}
                      </div>
                    ) : (
                      <button onClick={() => setPayingOrderId(order.id)}
                        className="bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-[0_4px_12px_rgba(34,197,94,0.25)]">
                        💰 {hasSavedExtras ? "Modifica / Incassa" : "Incassa"}
                      </button>
                    )}
                  </div>

                  {/* Annulla pagamento */}
                  {order.isPaid && (
                    isReverting ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleRevertPayment(order.id)} className="flex-1 bg-yellow-600 text-white text-xs font-bold py-2.5 rounded-xl">↩ Sì, annulla</button>
                        <button onClick={() => setConfirmRevert(null)} className="flex-1 bg-gray-700 text-gray-300 text-xs py-2.5 rounded-xl">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRevert(order.id)}
                        className="w-full bg-gray-700/40 text-gray-500 text-xs py-2 rounded-xl border border-gray-700/40 hover:text-yellow-300 transition-colors">
                        ↩ Annulla pagamento
                      </button>
                    )
                  )}

                  {/* Elimina */}
                  {isDeleting ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleCancelOrder(order.id)} className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl">🗑 Sì, elimina</button>
                      <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-700 text-gray-300 text-xs py-2.5 rounded-xl">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(order.id)}
                      className="w-full text-gray-700 text-xs py-1.5 hover:text-red-400 transition-colors rounded-lg">
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
