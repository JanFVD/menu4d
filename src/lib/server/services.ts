import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  PAYMENT_METHODS,
  type CartItemInput,
  type DashboardSnapshot,
  type OrderDTO,
  type OrderStatus,
  type PaymentDTO,
  type PaymentMethod,
  type ServiceRequestDTO,
  type ServiceRequestType,
  type TableDTO,
  type TableStateDTO,
} from '@/lib/types';

/** Error de negocio: su mensaje se devuelve tal cual al cliente. */
export class AppError extends Error {}

// ----------------------------------------------------------------------------- Serializers
const orderInclude = {
  table: true,
  items: { include: { product: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude;
type OrderWithRels = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const requestInclude = { table: true } satisfies Prisma.ServiceRequestInclude;
type RequestWithRels = Prisma.ServiceRequestGetPayload<{ include: typeof requestInclude }>;

const paymentInclude = {
  table: true,
  orders: {
    include: {
      items: {
        include: { product: true },
      },
    },
  },
} satisfies Prisma.PaymentInclude;
type PaymentWithRels = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const toTableDTO = (t: { id: string; number: number; status: TableDTO['status'] }): TableDTO => ({
  id: t.id,
  number: t.number,
  status: t.status,
});

export const toOrderDTO = (o: OrderWithRels): OrderDTO => ({
  id: o.id,
  number: o.number,
  tableId: o.tableId,
  tableNumber: o.table.number,
  status: o.status,
  total: o.total,
  items: o.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    name: i.product.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    notes: i.notes,
  })),
  createdAt: o.createdAt.toISOString(),
  confirmedAt: iso(o.confirmedAt),
  readyAt: iso(o.readyAt),
  deliveredAt: iso(o.deliveredAt),
});

export const toRequestDTO = (r: RequestWithRels): ServiceRequestDTO => ({
  id: r.id,
  tableId: r.tableId,
  tableNumber: r.table.number,
  type: r.type,
  paymentMethod: r.paymentMethod,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
});

export const toPaymentDTO = (p: PaymentWithRels): PaymentDTO => {
  const itemMap = new Map<string, { name: string; quantity: number; unitPrice: number; total: number }>();
  p.orders?.forEach((o) => {
    o.items?.forEach((i) => {
      const prev = itemMap.get(i.productId) ?? {
        name: i.product?.name ?? 'Producto',
        quantity: 0,
        unitPrice: i.unitPrice,
        total: 0,
      };
      prev.quantity += i.quantity;
      prev.total += i.quantity * i.unitPrice;
      itemMap.set(i.productId, prev);
    });
  });

  return {
    id: p.id,
    tableId: p.tableId,
    tableNumber: p.table.number,
    method: p.method,
    amount: p.amount,
    cashierName: p.cashierName,
    items: [...itemMap.values()],
    createdAt: p.createdAt.toISOString(),
  };
};

// ----------------------------------------------------------------------------- Queries
async function requireTable(tableId: unknown) {
  if (typeof tableId !== 'string' || !tableId) throw new AppError('Mesa inválida');
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) throw new AppError('La mesa no existe');
  return table;
}

export async function getTableState(tableId: string): Promise<TableStateDTO> {
  const table = await requireTable(tableId);
  const [orders, requests] = await Promise.all([
    prisma.order.findMany({
      where: { tableId, status: { not: 'paid' } },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.serviceRequest.findMany({
      where: { tableId, status: 'pending' },
      include: requestInclude,
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return { table: toTableDTO(table), orders: orders.map(toOrderDTO), requests: requests.map(toRequestDTO) };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const startOfShift = new Date();
  startOfShift.setHours(0, 0, 0, 0);

  const [tables, orders, requests, payments, settings] = await Promise.all([
    prisma.table.findMany({ orderBy: { number: 'asc' } }),
    prisma.order.findMany({ where: { status: { not: 'paid' } }, include: orderInclude, orderBy: { createdAt: 'asc' } }),
    prisma.serviceRequest.findMany({ where: { status: 'pending' }, include: requestInclude, orderBy: { createdAt: 'asc' } }),
    prisma.payment.findMany({
      where: { createdAt: { gte: startOfShift } },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.businessSetting.findUnique({ where: { id: 'default' } }),
  ]);

  return {
    tables: tables.map(toTableDTO),
    orders: orders.map(toOrderDTO),
    requests: requests.map(toRequestDTO),
    payments: payments.map(toPaymentDTO),
    settings: settings ?? undefined,
  };
}

// ----------------------------------------------------------------------------- Commands
const MAX_QTY = 50;
const MAX_NOTES = 200;

export async function createOrder(tableId: string, items: CartItemInput[]) {
  await requireTable(tableId);
  if (!Array.isArray(items) || items.length === 0) throw new AppError('El pedido está vacío');
  if (items.length > 50) throw new AppError('Demasiados ítems en el pedido');

  for (const it of items) {
    if (typeof it?.productId !== 'string') throw new AppError('Producto inválido');
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > MAX_QTY) throw new AppError('Cantidad inválida');
    if (it.notes != null && (typeof it.notes !== 'string' || it.notes.length > MAX_NOTES)) throw new AppError('Nota inválida');
  }

  // Precios SIEMPRE desde la base: nunca confiar en el cliente.
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] }, available: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const missing = items.find((i) => !byId.has(i.productId));
  if (missing) throw new AppError('Algún producto ya no está disponible');

  const total = items.reduce((acc, i) => acc + byId.get(i.productId)!.price * i.quantity, 0);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        tableId,
        total,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: byId.get(i.productId)!.price,
            notes: i.notes?.trim() || null,
          })),
        },
      },
      include: orderInclude,
    });
    const table = await tx.table.update({ where: { id: tableId }, data: { status: 'occupied' } });
    return { order: toOrderDTO(order), table: toTableDTO(table) };
  });
}

/** Máquina de estados de la orden (el cobro → `paid` sólo ocurre vía confirmPayment). */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ['confirmed'],
  confirmed: ['cooking', 'on_the_way'],
  cooking: ['on_the_way'],
  on_the_way: ['delivered'],
  delivered: [],
  paid: [],
};

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new AppError('La orden no existe');
  if (!TRANSITIONS[current.status].includes(status)) {
    throw new AppError(`Transición inválida: ${current.status} → ${status}`);
  }
  const now = new Date();
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(status === 'confirmed' && { confirmedAt: now }),
      ...(status === 'on_the_way' && { readyAt: now }),
      ...(status === 'delivered' && { deliveredAt: now }),
    },
    include: orderInclude,
  });
  return toOrderDTO(order);
}

export async function createServiceRequest(tableId: string, type: ServiceRequestType, paymentMethod?: PaymentMethod) {
  await requireTable(tableId);
  if (type !== 'call_waiter' && type !== 'request_bill') throw new AppError('Tipo de solicitud inválido');
  if (type === 'request_bill' && (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod))) {
    throw new AppError('Elegí un método de pago');
  }

  // Evita duplicados: si ya hay una pendiente del mismo tipo, se actualiza (y se vuelve a notificar).
  const existing = await prisma.serviceRequest.findFirst({ where: { tableId, type, status: 'pending' } });

  return prisma.$transaction(async (tx) => {
    const req = existing
      ? await tx.serviceRequest.update({
          where: { id: existing.id },
          data: { paymentMethod: type === 'request_bill' ? paymentMethod : null, createdAt: new Date() },
          include: requestInclude,
        })
      : await tx.serviceRequest.create({
          data: { tableId, type, paymentMethod: type === 'request_bill' ? paymentMethod : null },
          include: requestInclude,
        });
    const table = await tx.table.update({ where: { id: tableId }, data: { status: 'occupied' } });
    return { request: toRequestDTO(req), table: toTableDTO(table), isNew: !existing };
  });
}

export async function resolveServiceRequest(requestId: string) {
  const existing = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new AppError('La solicitud no existe');
  const req = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: 'resolved', resolvedAt: new Date() },
    include: requestInclude,
  });
  return toRequestDTO(req);
}

/**
 * Cierra la mesa: crea el Payment con el total de las órdenes impagas,
 * marca órdenes como `paid`, resuelve solicitudes pendientes y libera la mesa.
 */
export async function confirmPayment(tableId: string, method: PaymentMethod, cashierName?: string) {
  await requireTable(tableId);
  if (!PAYMENT_METHODS.includes(method)) throw new AppError('Método de pago inválido');

  return prisma.$transaction(async (tx) => {
    const unpaid = await tx.order.findMany({ where: { tableId, status: { not: 'paid' } } });
    const amount = unpaid.reduce((acc, o) => acc + o.total, 0);
    const now = new Date();

    const createdPayment =
      amount > 0
        ? await tx.payment.create({
            data: { tableId, method, amount, cashierName: cashierName ?? null },
          })
        : null;

    if (unpaid.length && createdPayment) {
      await tx.order.updateMany({
        where: { id: { in: unpaid.map((o) => o.id) } },
        data: { status: 'paid', paidAt: now, paymentId: createdPayment.id },
      });
    }

    const payment = createdPayment
      ? await tx.payment.findUnique({
          where: { id: createdPayment.id },
          include: paymentInclude,
        })
      : null;

    const pending = await tx.serviceRequest.findMany({ where: { tableId, status: 'pending' }, include: requestInclude });
    await tx.serviceRequest.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data: { status: 'resolved', resolvedAt: now },
    });

    const table = await tx.table.update({ where: { id: tableId }, data: { status: 'free' } });

    return {
      payment: payment ? toPaymentDTO(payment) : null,
      paidOrderIds: unpaid.map((o) => o.id),
      resolvedRequests: pending.map((r) => ({ ...toRequestDTO(r), status: 'resolved' as const })),
      table: toTableDTO(table),
    };
  });
}

