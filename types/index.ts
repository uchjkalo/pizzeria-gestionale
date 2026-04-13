export type OrderStatus   = "attesa" | "preparazione" | "pronto" | "consegnato";
export type OrderType     = "tavolo" | "asporto" | "delivery";
export type PaymentMethod = "contanti" | "carta";
export type UserRole      = "admin" | "operatore";
export type ItemSize      = "baby" | "normale" | "maxi";

export interface ManualAddition {
  name: string;
  price: number;
}

export interface OrderItem {
  cartId: string;
  id: string;
  name: string;
  category: string;
  size: ItemSize;
  basePrice: number;
  effectivePrice: number;
  quantity: number;
  removedIngredients: string[];
  addedIngredients: { name: string; price: number }[];
  manualAdditions: ManualAddition[];
  notes: string;
  // Pizza personalizzata
  customName?: string;
  isHalf?: boolean;
  halfPizza1?: { id: string; name: string; price: number };
  halfPizza2?: { id: string; name: string; price: number };
}

export interface ExtraItem {
  description: string;
  price: number;
}

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  extras: ExtraItem[];
  // Tavolo
  tableNumber?: number;
  peopleCount?: number;
  // Asporto / Delivery
  customerName?: string;
  // Delivery
  deliveryAddress?: string;
  deliveryCost?: number;
  // Generali
  desiredTime?: string;
  isUrgent: boolean;
  orderNotes?: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  // Annullamento
  isCancelled?: boolean;
  cancelledAt?: Date;
  // Pagamento — separato dal flusso cibo
  isPaid?: boolean;
  paymentMethod?: "contanti" | "carta";
  felice?: boolean;
  paidAt?: Date;
}

export interface KitchenTask {
  id: string;
  orderId: string;
  description: string;
  zone: "cucina" | "fritture";
  completed: boolean;
  createdAt: Date;
}
