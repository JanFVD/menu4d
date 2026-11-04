'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSocket, request, useConnected } from '@/lib/socket-client';
import { playChime } from '@/lib/utils';
import type {
  DashboardSnapshot,
  OrderDTO,
  OrderStatus,
  PaymentDTO,
  PaymentMethod,
  ServiceRequestDTO,
  TableDTO,
} from '@/lib/types';

// ----------------------------------------------------------------------------- Store
type State = DashboardSnapshot & { ready: boolean };

type Action =
  | { type: 'snapshot'; data: DashboardSnapshot }
  | { type: 'order'; order: OrderDTO }
  | { type: 'request'; request: ServiceRequestDTO }
  | { type: 'table'; table: TableDTO }
  | { type: 'payment'; payment: PaymentDTO }
  | { type: 'closed'; orderIds: string[] };

function upsert<T extends { id: string }>(list: T[], item: T, keep: boolean) {
  if (!keep) return list.filter((x) => x.id !== item.id);
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'snapshot':
      return { ...action.data, ready: true };
    case 'order':
      return { ...state, orders: upsert(state.orders, action.order, action.order.status !== 'paid') };
    case 'request':
      return { ...state, requests: upsert(state.requests, action.request, action.request.status === 'pending') };
    case 'table':
      return { ...state, tables: upsert(state.tables, action.table, true).sort((a, b) => a.number - b.number) };
    case 'payment':
      return state.payments.some((p) => p.id === action.payment.id)
        ? state
        : { ...state, payments: [action.payment, ...state.payments] };
    case 'closed':
      return { ...state, orders: state.orders.filter((o) => !action.orderIds.includes(o.id)) };
  }
}

const initial: State = { tables: [], orders: [], requests: [], payments: [], ready: false };

interface DashboardContextValue extends State {
  connected: boolean;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  resolveRequest: (requestId: string) => Promise<void>;
  confirmPayment: (tableId: string, method: PaymentMethod) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard debe usarse dentro de <DashboardProvider>');
  return ctx;
}

// ----------------------------------------------------------------------------- Provider
export function DashboardProvider({ children, sound = true }: { children: React.ReactNode; sound?: boolean }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const connected = useConnected();
  const [error, setError] = useState<string | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const pinRef = useRef<string | undefined>(undefined);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const join = useCallback(async () => {
    const s = getSocket();
    try {
      const data = await request<DashboardSnapshot>((ack) => s.emit('staff:join', { pin: pinRef.current }, ack));
      dispatch({ type: 'snapshot', data });
      setNeedsPin(false);
      if (pinRef.current) sessionStorage.setItem('menu4d:pin', pinRef.current);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('PIN')) {
        sessionStorage.removeItem('menu4d:pin');
        setNeedsPin(true);
      } else setError(msg);
    }
  }, []);

  useEffect(() => {
    pinRef.current = sessionStorage.getItem('menu4d:pin') ?? undefined;
    const s = getSocket();

    const onOrderCreated = (order: OrderDTO) => {
      dispatch({ type: 'order', order });
      if (soundRef.current) playChime(988);
    };
    const onOrder = (order: OrderDTO) => dispatch({ type: 'order', order });
    const onRequestCreated = (r: ServiceRequestDTO) => {
      dispatch({ type: 'request', request: r });
      if (soundRef.current) playChime(r.type === 'call_waiter' ? 660 : 523);
    };
    const onRequest = (r: ServiceRequestDTO) => {
      dispatch({ type: 'request', request: r });
      // Re-aviso de una solicitud pendiente existente (el cliente insistió)
      if (r.status === 'pending' && soundRef.current) playChime(660);
    };
    const onTable = (table: TableDTO) => dispatch({ type: 'table', table });
    const onPayment = (payment: PaymentDTO) => dispatch({ type: 'payment', payment });
    const onClosed = ({ orderIds }: { orderIds: string[] }) => dispatch({ type: 'closed', orderIds });

    if (s.connected) join();
    s.on('connect', join);
    s.on('order:created', onOrderCreated);
    s.on('order:updated', onOrder);
    s.on('service:created', onRequestCreated);
    s.on('service:updated', onRequest);
    s.on('table:updated', onTable);
    s.on('payment:created', onPayment);
    s.on('table:closed', onClosed);
    return () => {
      s.off('connect', join);
      s.off('order:created', onOrderCreated);
      s.off('order:updated', onOrder);
      s.off('service:created', onRequestCreated);
      s.off('service:updated', onRequest);
      s.off('table:updated', onTable);
      s.off('payment:created', onPayment);
      s.off('table:closed', onClosed);
    };
  }, [join]);

  // Las respuestas (ack) también actualizan el store: la UI no depende sólo del broadcast.
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const value = useMemo<DashboardContextValue>(
    () => ({
      ...state,
      connected,
      error,
      clearError: () => setError(null),
      updateOrderStatus: (orderId, status) =>
        run(async () => {
          const s = getSocket();
          const order = await request<OrderDTO>((ack) => s.emit('order:status', { orderId, status }, ack));
          dispatch({ type: 'order', order });
        }),
      resolveRequest: (requestId) =>
        run(async () => {
          const s = getSocket();
          const r = await request<ServiceRequestDTO>((ack) => s.emit('service:resolve', { requestId }, ack));
          dispatch({ type: 'request', request: r });
        }),
      confirmPayment: (tableId, method) =>
        run(async () => {
          const s = getSocket();
          const payment = await request<PaymentDTO | null>((ack) => s.emit('payment:confirm', { tableId, method }, ack));
          if (payment) dispatch({ type: 'payment', payment });
        }),
    }),
    [state, connected, error, run],
  );

  if (needsPin) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <form
          className="w-full max-w-xs space-y-4 rounded-xl border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            pinRef.current = pinInput;
            join();
          }}
        >
          <KeyRound className="h-8 w-8 text-primary" />
          <h1 className="text-lg font-bold">PIN del local</h1>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" className="w-full">
            Ingresar
          </Button>
        </form>
      </div>
    );
  }

  if (!state.ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Conectando con el local…
        {error && <span className="text-red-400">({error})</span>}
      </div>
    );
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

