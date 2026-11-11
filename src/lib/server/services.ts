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

export const tableInclude = {
  mergedWithTable: { select: { id: true, number: true } },
  mergedTables: { select: { id: true, number: true } },
} satisfies Prisma.TableInclude;

type TableWithRels = Prisma.TableGetPayload<{ include: typeof tableInclude }>;

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

export const toTableDTO = (t: {
  id: string;
  number: number;
  floor?: number;
  status: TableDTO['status'];
  sessionCode?: string | null;
  mergedWithTableId?: string | null;
  mergedWithTable?: { id: string; number: number } | null;
  mergedTables?: { id: string; number: number }[];
}): TableDTO => ({
  id: t.id,
  number: t.number,
  floor: t.floor ?? 1,
  status: t.status,
  sessionCode: t.sessionCode ?? null,
  mergedWithTableId: t.mergedWithTableId ?? null,
  mergedWithTableNumber: t.mergedWithTable?.number ?? null,
  mergedTables: t.mergedTables?.map((m) => ({ id: m.id, number: m.number })) ?? [],
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
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: tableInclude,
  });
  if (!table) throw new AppError('La mesa no existe');
  return table;
}

export async function getTableState(tableId: string, clientPin?: string): Promise<TableStateDTO> {
  let table = await requireTable(tableId);

  // Si esta mesa está unida a otra, trabajar con la mesa principal
  if (table.mergedWithTableId) {
    const parentTable = await prisma.table.findUnique({
      where: { id: table.mergedWithTableId },
      include: tableInclude,
    });
    if (parentTable) {
      table = parentTable;
      tableId = parentTable.id;
    }
  }

  let sessionCode = table.sessionCode;
  let needsPin = false;

  if (!sessionCode) {
    // Primera persona que escanea la mesa: crear PIN de 4 dígitos automático
    sessionCode = Math.floor(1000 + Math.random() * 9000).toString();
    table = await prisma.table.update({
      where: { id: table.id },
      data: { sessionCode, status: 'occupied' },
      include: tableInclude,
    });
  } else {
    // Ya existe sesión activa: validar si el cliente envió el PIN correcto
    if (!clientPin || clientPin.trim() !== sessionCode) {
      needsPin = true;
    }
  }

  if (needsPin) {
    return {
      table: toTableDTO(table),
      orders: [],
      requests: [],
      sessionCode: null,
      needsPin: true,
    };
  }

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
  return {
    table: toTableDTO(table),
    orders: orders.map(toOrderDTO),
    requests: requests.map(toRequestDTO),
    sessionCode,
    needsPin: false,
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const startOfShift = new Date();
  startOfShift.setHours(0, 0, 0, 0);

  const [tables, orders, requests, payments, settings] = await Promise.all([
    prisma.table.findMany({
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      include: tableInclude,
    }),
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

    const table = await tx.table.update({
      where: { id: tableId },
      data: { status: 'free', sessionCode: null },
      include: tableInclude,
    });

    // Si la mesa tenía mesas unidas a ella, liberarlas también
    const mergedSecondaries = await tx.table.findMany({
      where: { mergedWithTableId: tableId },
      include: tableInclude,
    });
    if (mergedSecondaries.length > 0) {
      await tx.table.updateMany({
        where: { mergedWithTableId: tableId },
        data: { status: 'free', sessionCode: null, mergedWithTableId: null },
      });
    }

    return {
      payment: payment ? toPaymentDTO(payment) : null,
      paidOrderIds: unpaid.map((o) => o.id),
      resolvedRequests: pending.map((r) => ({ ...toRequestDTO(r), status: 'resolved' as const })),
      table: toTableDTO(table),
      freedSecondaryTableIds: mergedSecondaries.map((m) => m.id),
    };
  });
}

/** Mozo/Staff cancela la sesión activa y libera la mesa (ej: cliente se fue sin pedir). */
export async function cancelSession(tableId: string) {
  await requireTable(tableId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Buscar órdenes impagas asociadas
    const unpaid = await tx.order.findMany({ where: { tableId, status: { not: 'paid' } } });
    if (unpaid.length) {
      await tx.order.updateMany({
        where: { id: { in: unpaid.map((o) => o.id) } },
        data: { status: 'paid', paidAt: now },
      });
    }

    // Resolver solicitudes pendientes
    const pending = await tx.serviceRequest.findMany({ where: { tableId, status: 'pending' }, include: requestInclude });
    if (pending.length) {
      await tx.serviceRequest.updateMany({
        where: { id: { in: pending.map((r) => r.id) } },
        data: { status: 'resolved', resolvedAt: now },
      });
    }

    // Liberar mesa
    const table = await tx.table.update({
      where: { id: tableId },
      data: { status: 'free', sessionCode: null },
      include: tableInclude,
    });

    // Liberar mesas secundarias unidas si las hubiere
    const merged = await tx.table.findMany({ where: { mergedWithTableId: tableId } });
    if (merged.length) {
      await tx.table.updateMany({
        where: { mergedWithTableId: tableId },
        data: { status: 'free', sessionCode: null, mergedWithTableId: null },
      });
    }

    return {
      table: toTableDTO(table),
      cancelledOrderIds: unpaid.map((o) => o.id),
      resolvedRequests: pending.map((r) => ({ ...toRequestDTO(r), status: 'resolved' as const })),
      secondaryTableIds: merged.map((m) => m.id),
    };
  });
}

/** Mozo une dos mesas (ej: Mesa 3 se une a Mesa 2). */
export async function mergeTables(primaryTableId: string, secondaryTableId: string) {
  if (primaryTableId === secondaryTableId) throw new AppError('No puedes unir una mesa consigo misma');
  const primary = await requireTable(primaryTableId);
  const secondary = await requireTable(secondaryTableId);

  return prisma.$transaction(async (tx) => {
    // Si la mesa secundaria tenía pedidos impagos, transferirlos a la principal
    await tx.order.updateMany({
      where: { tableId: secondaryTableId, status: { not: 'paid' } },
      data: { tableId: primaryTableId },
    });
    await tx.serviceRequest.updateMany({
      where: { tableId: secondaryTableId, status: 'pending' },
      data: { tableId: primaryTableId },
    });

    const sessionCode = primary.sessionCode || Math.floor(1000 + Math.random() * 9000).toString();

    // Actualizar mesa principal
    const updatedPrimary = await tx.table.update({
      where: { id: primaryTableId },
      data: { status: 'occupied', sessionCode },
      include: tableInclude,
    });

    // Actualizar mesa secundaria
    const updatedSecondary = await tx.table.update({
      where: { id: secondaryTableId },
      data: {
        mergedWithTableId: primaryTableId,
        status: 'occupied',
        sessionCode,
      },
      include: tableInclude,
    });

    return {
      primary: toTableDTO(updatedPrimary),
      secondary: toTableDTO(updatedSecondary),
    };
  });
}

/** Mozo separa una mesa unida. */
export async function unmergeTable(tableId: string) {
  const table = await requireTable(tableId);

  return prisma.$transaction(async (tx) => {
    const parentId = table.mergedWithTableId;

    if (parentId) {
      // Es una mesa secundaria: desvincularla
      await tx.table.update({
        where: { id: tableId },
        data: { mergedWithTableId: null, status: 'free', sessionCode: null },
      });
    } else {
      // Es la mesa principal: desvincular todas las secundarias unidas a ella
      await tx.table.updateMany({
        where: { mergedWithTableId: tableId },
        data: { mergedWithTableId: null, status: 'free', sessionCode: null },
      });
    }

    const refetched = await tx.table.findUnique({
      where: { id: tableId },
      include: tableInclude,
    });

    return toTableDTO(refetched!);
  });
}

