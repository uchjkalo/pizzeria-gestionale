export type OrderStatus   = "attesa" | "preparazione" | "pronto" | "consegnato";
export type OrderType     = "tavolo" | "asporto" | "delivery";
export type PaymentMethod = "contanti" | "carta";
export type UserRole      = "admin" | "operatore";
export type ItemSize      = "baby" | "normale" | "maxi";

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
  notes: string;
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
  tableNumber?: number;
  peopleCount?: number;
  customerName?: string;
  deliveryAddress?: string;
  deliveryCost?: number;
  desiredTime?: string;
  isUrgent: boolean;
  orderNotes?: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
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

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  extras: ExtraItem[];
  tableNumber?: number;
  peopleCount?: number;
  customerName?: string;
  deliveryAddress?: string;
  deliveryCost?: number;
  desiredTime?: string;
  isUrgent: boolean;
  orderNotes?: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  // Cassa
  paymentMethod?: "contanti" | "carta";
  felice?: boolean;
  paidAt?: Date;
}