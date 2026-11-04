import type { Server, Socket } from 'socket.io';
import {
  rooms,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from '@/lib/types';
import {
  AppError,
  confirmPayment,
  createOrder,
  createServiceRequest,
  getDashboardSnapshot,
  getTableState,
  resolveServiceRequest,
  updateOrderStatus,
} from './services';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Ejecuta un handler y responde por ack con { ok, data } | { ok:false, error }. */
async function handle<T>(ack: Ack<T> | undefined, fn: () => Promise<T>) {
  const reply = typeof ack === 'function' ? ack : () => {};
  try {
    reply({ ok: true, data: await fn() });
  } catch (err) {
    if (err instanceof AppError) return reply({ ok: false, error: err.message });
    console.error('[socket]', err);
    reply({ ok: false, error: 'Error interno del servidor' });
  }
}

function requireStaff(socket: AppSocket) {
  if (socket.data.role !== 'staff') throw new AppError('No autorizado');
}

function requireTable(socket: AppSocket) {
  if (socket.data.role !== 'table' || !socket.data.tableId) throw new AppError('Escaneá el QR de tu mesa');
  return socket.data.tableId;
}

export function registerSocketHandlers(io: IO) {
  /** Emite a staff + dispositivos de la mesa. */
  const toTableAndStaff = (tableId: string) => io.to(rooms.staff).to(rooms.table(tableId));

  io.on('connection', (socket: AppSocket) => {
    // ------------------------------------------------------------------ Join
    socket.on('table:join', (payload, ack) =>
      handle(ack, async () => {
        const state = await getTableState(payload?.tableId);
        if (socket.data.tableId && socket.data.tableId !== state.table.id) {
          socket.leave(rooms.table(socket.data.tableId));
        }
        socket.data.role = 'table';
        socket.data.tableId = state.table.id;
        await socket.join(rooms.table(state.table.id));
        return state;
      }),
    );

    socket.on('staff:join', (payload, ack) =>
      handle(ack, async () => {
        const pin = process.env.STAFF_PIN;
        if (pin && payload?.pin !== pin) throw new AppError('PIN incorrecto');
        socket.data.role = 'staff';
        await socket.join(rooms.staff);
        return getDashboardSnapshot();
      }),
    );

    // ------------------------------------------------------------------ Orders
    socket.on('order:create', (payload, ack) =>
      handle(ack, async () => {
        const tableId = requireTable(socket);
        const { order, table } = await createOrder(tableId, payload?.items);
        toTableAndStaff(tableId).emit('order:created', order);
        toTableAndStaff(tableId).emit('table:updated', table);
        return order;
      }),
    );

    socket.on('order:status', (payload, ack) =>
      handle(ack, async () => {
        requireStaff(socket);
        const order = await updateOrderStatus(payload?.orderId, payload?.status);
        toTableAndStaff(order.tableId).emit('order:updated', order);
        return order;
      }),
    );

    // ------------------------------------------------------------------ Service requests
    socket.on('service:request', (payload, ack) =>
      handle(ack, async () => {
        const tableId = requireTable(socket);
        const { request, table, isNew } = await createServiceRequest(tableId, payload?.type, payload?.paymentMethod);
        toTableAndStaff(tableId).emit(isNew ? 'service:created' : 'service:updated', request);
        toTableAndStaff(tableId).emit('table:updated', table);
        return request;
      }),
    );

    socket.on('service:resolve', (payload, ack) =>
      handle(ack, async () => {
        requireStaff(socket);
        const request = await resolveServiceRequest(payload?.requestId);
        toTableAndStaff(request.tableId).emit('service:updated', request);
        return request;
      }),
    );

    // ------------------------------------------------------------------ Caja
    socket.on('payment:confirm', (payload, ack) =>
      handle(ack, async () => {
        requireStaff(socket);
        const result = await confirmPayment(payload?.tableId, payload?.method);
        const tableId = result.table.id;
        if (result.payment) io.to(rooms.staff).emit('payment:created', result.payment);
        for (const r of result.resolvedRequests) toTableAndStaff(tableId).emit('service:updated', r);
        toTableAndStaff(tableId).emit('table:updated', result.table);
        toTableAndStaff(tableId).emit('table:closed', { tableId, orderIds: result.paidOrderIds });
        return result.payment;
      }),
    );
  });
}
