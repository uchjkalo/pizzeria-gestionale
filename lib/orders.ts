import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where,
  Timestamp, serverTimestamp, getDocs, writeBatch,
} from "firebase/firestore";
import { Order } from "@/types";

const ordersRef = collection(db, "orders");

const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const mapDoc = (d: any): Order => ({
  id: d.id,
  ...d.data(),
  createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
  updatedAt: (d.data().updatedAt as Timestamp)?.toDate() ?? new Date(),
  paidAt:    d.data().paidAt ? (d.data().paidAt as Timestamp).toDate() : undefined,
});

// ── Crea ordine ──
export const createOrder = async (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
  const clean = stripUndefined(order as unknown as Record<string, unknown>);
  const ref = await addDoc(ordersRef, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

// ── Aggiorna status cibo ──
export const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
  await updateDoc(doc(db, "orders", orderId), { status, updatedAt: serverTimestamp() });
};

// ── Aggiorna campo generico ──
export const updateOrder = async (orderId: string, data: Partial<Order>) => {
  await updateDoc(doc(db, "orders", orderId), { ...data, updatedAt: serverTimestamp() });
};

// ── Paga ordine (indipendente dallo status cibo) ──
export const payOrder = async (
  orderId: string,
  data: { paymentMethod: "contanti" | "carta"; felice: boolean }
) => {
  await updateDoc(doc(db, "orders", orderId), {
    isPaid: true,
    paymentMethod: data.paymentMethod,
    felice: data.felice,
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// ── Ordini attivi (non ancora consegnati) — per cucina e fritture ──
export const subscribeToActiveOrders = (callback: (orders: Order[]) => void) => {
  const q = query(ordersRef, orderBy("createdAt", "asc"));
  return onSnapshot(q, snap => {
    callback(
      snap.docs.map(mapDoc)
        .filter(o => o.status !== "consegnato" && !o.isCancelled)
    );
  });
};

// ── Tutti gli ordini di oggi — per preparazione e cassa ──
export const subscribeToOrdersToday = (callback: (orders: Order[]) => void) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(ordersRef, orderBy("createdAt", "asc"));
  return onSnapshot(q, snap => {
    callback(
      snap.docs.map(mapDoc)
        .filter(o => o.createdAt >= startOfDay && !o.isCancelled)
    );
  });
};

// ── Ordini pagati oggi — per statistiche ──
export const subscribeToPaidToday = (callback: (orders: Order[]) => void) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(ordersRef, where("isPaid", "==", true), orderBy("paidAt", "desc"));
  return onSnapshot(q, snap => {
    callback(
  snap.docs.map(mapDoc).filter(o => o.paidAt && o.paidAt >= startOfDay && !o.isCancelled)
    );
  });
};

// ── Azzera statistiche giornaliere (reset completo) ──
export const resetPaidTodayStats = async (): Promise<number> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const q = query(ordersRef, where("isPaid", "==", true), orderBy("paidAt", "desc"));
  const snap = await getDocs(q);
  const docsToDelete = snap.docs.filter(d => {
    const paidAt = d.data().paidAt as Timestamp | undefined;
    return paidAt && paidAt.toDate() >= startOfDay;
  });

  if (docsToDelete.length === 0) return 0;

  const batch = writeBatch(db);
  docsToDelete.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return docsToDelete.length;
};

// ── Annulla ordine (escluso da statistiche) ──
export const cancelOrder = async (orderId: string) => {
  await updateDoc(doc(db, "orders", orderId), {
    isCancelled: true,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// ── Annulla pagamento (torna in "da pagare") ──
export const revertPayment = async (orderId: string) => {
  await updateDoc(doc(db, "orders", orderId), {
    isPaid: false,
    paymentMethod: null,
    felice: null,
    paidAt: null,
    updatedAt: serverTimestamp(),
  });
};
