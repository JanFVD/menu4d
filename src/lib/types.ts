/**
 * Contrato compartido cliente ⇄ servidor.
 * Los mismos tipos se usan en server.ts (Socket.io Server) y en el navegador (socket.io-client),
 * así cualquier cambio en un evento rompe la compilación en ambos lados.
 */

export type TableStatus = 'free' | 'occupied';
export type OrderStatus = 'received' | 'confirmed' | 'cooking' | 'on_the_way' | 'delivered' | 'paid';
export type ServiceRequestType = 'call_waiter' | 'request_bill';
export type ServiceRequestStatus = 'pending' | 'resolved';
export type PaymentMethod = 'cash' | 'mercado_pago' | 'credit_card' | 'debit_card';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'mercado_pago', 'credit_card', 'debit_card'];

// ----------------------------------------------------------------------------- DTOs
export interface TableDTO {
  id: string;
  number: number;
  status: TableStatus;
}

export interface ProductDTO {
  id: string;
  name: string;
  description: string;
  price: number; // centavos
  imageUrl: string | null;
}

export interface CategoryDTO {
  id: string;
  name: string;
  products: ProductDTO[];
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface OrderDTO {
  id: string;
  number: number;
  tableId: string;
  tableNumber: number;
  status: OrderStatus;
  total: number;
  items: OrderItemDTO[];
  createdAt: string; // ISO
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
}

export interface ServiceRequestDTO {
  id: string;
  tableId: string;
  tableNumber: number;
  type: ServiceRequestType;
  paymentMethod: PaymentMethod | null;
  status: ServiceRequestStatus;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  tableId: string;
  tableNumber: number;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
}

/** Estado que recibe la pantalla del cliente al unirse a su mesa. */
export interface TableStateDTO {
  table: TableDTO;
  orders: OrderDTO[]; // órdenes impagas de la mesa
  requests: ServiceRequestDTO[]; // solicitudes pendientes
}

/** Estado inicial del dashboard (salón, cocina y caja). */
export interface DashboardSnapshot {
  tables: TableDTO[];
  orders: OrderDTO[]; // todas las órdenes impagas
  requests: ServiceRequestDTO[]; // solicitudes pendientes
  payments: PaymentDTO[]; // cobros del turno (desde 00:00)
}

// ----------------------------------------------------------------------------- Payloads
export interface CartItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (res: AckResponse<T>) => void;

// ----------------------------------------------------------------------------- Eventos
/**
 * Cliente → Servidor (comandos). Todos usan acknowledgement para confirmar/rechazar.
 *
 * Rooms:
 *   - `table:<tableId>`: dispositivos de los comensales de esa mesa
 *   - `staff`: dashboard (resumen, salón, cocina, caja)
 */
export interface ClientToServerEvents {
  /** Comensal escanea el QR → se une al room de su mesa. */
  'table:join': (payload: { tableId: string }, ack: Ack<TableStateDTO>) => void;
  /** Dashboard se une al room `staff` (PIN opcional vía STAFF_PIN). */
  'staff:join': (payload: { pin?: string }, ack: Ack<DashboardSnapshot>) => void;

  /** Comensal envía comanda (la mesa se toma del socket, no del payload). */
  'order:create': (payload: { items: CartItemInput[] }, ack: Ack<OrderDTO>) => void;
  /** Staff avanza el estado de una orden (KDS "Confirmar", "Listo", salón "Entregado"). */
  'order:status': (payload: { orderId: string; status: OrderStatus }, ack: Ack<OrderDTO>) => void;

  /** Comensal: "Llamar al mozo" o "Pedir la cuenta" (con método de pago). */
  'service:request': (
    payload: { type: ServiceRequestType; paymentMethod?: PaymentMethod },
    ack: Ack<ServiceRequestDTO>,
  ) => void;
  /** Staff marca una solicitud como atendida. */
  'service:resolve': (payload: { requestId: string }, ack: Ack<ServiceRequestDTO>) => void;

  /** Caja confirma el cobro → órdenes `paid`, solicitudes resueltas, mesa `free`. */
  'payment:confirm': (payload: { tableId: string; method: PaymentMethod }, ack: Ack<PaymentDTO | null>) => void;
}

/** Servidor → Clientes (broadcasts). */
export interface ServerToClientEvents {
  'order:created': (order: OrderDTO) => void; // → staff + table
  'order:updated': (order: OrderDTO) => void; // → staff + table
  'service:created': (req: ServiceRequestDTO) => void; // → staff + table
  'service:updated': (req: ServiceRequestDTO) => void; // → staff + table
  'table:updated': (table: TableDTO) => void; // → staff + table
  'payment:created': (payment: PaymentDTO) => void; // → staff
  /** → staff + table. Mesa cobrada: el cliente resetea su pantalla y el staff descarta esas órdenes. */
  'table:closed': (payload: { tableId: string; orderIds: string[] }) => void;
}

export interface SocketData {
  role?: 'staff' | 'table';
  tableId?: string;
}

export const rooms = {
  staff: 'staff',
  table: (tableId: string) => `table:${tableId}`,
} as const;
