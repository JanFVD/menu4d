'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChefHat, KeyRound, Loader2, Lock, ShieldCheck, UserCheck, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSocket, request, useConnected } from '@/lib/socket-client';
import { playChime } from '@/lib/utils';
import type {
  BusinessSettingDTO,
  DashboardSnapshot,
  OrderDTO,
  OrderStatus,
  PaymentDTO,
  PaymentMethod,
  ServiceRequestDTO,
  StaffUserDTO,
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
  | { type: 'settings'; settings: BusinessSettingDTO }
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
    case 'settings':
      return { ...state, settings: action.settings };
    case 'closed':
      return { ...state, orders: state.orders.filter((o) => !action.orderIds.includes(o.id)) };
  }
}

const initial: State = { tables: [], orders: [], requests: [], payments: [], ready: false };

interface DashboardContextValue extends State {
  connected: boolean;
  staffUser: StaffUserDTO | null;
  logout: () => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  resolveRequest: (requestId: string) => Promise<void>;
  confirmPayment: (tableId: string, method: PaymentMethod, cashierName?: string) => Promise<PaymentDTO | null>;
  updateSettings: (settings: BusinessSettingDTO) => void;
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

  // Staff authentication
  const [staffUser, setStaffUser] = useState<StaffUserDTO | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const pinRef = useRef<string | undefined>(undefined);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Restore staff session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('menu4d:staff_user');
      if (saved) {
        setStaffUser(JSON.parse(saved));
      }
    } catch {
      /* noop */
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const u = customUser || loginUsername;
    const p = customPass || loginPassword;
    if (!u || !p) {
      setLoginError('Ingresa usuario y contraseña');
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Credenciales inválidas');

      setStaffUser(data.user);
      localStorage.setItem('menu4d:staff_user', JSON.stringify(data.user));
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('menu4d:staff_user');
    setStaffUser(null);
  };

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
      if (r.status === 'pending' && soundRef.current) playChime(660);
    };
    const onTable = (table: TableDTO) => dispatch({ type: 'table', table });
    const onPayment = (payment: PaymentDTO) => dispatch({ type: 'payment', payment });
    const onSettings = (settings: BusinessSettingDTO) => dispatch({ type: 'settings', settings });
    const onClosed = ({ orderIds }: { orderIds: string[] }) => dispatch({ type: 'closed', orderIds });

    if (s.connected) join();
    s.on('connect', join);
    s.on('order:created', onOrderCreated);
    s.on('order:updated', onOrder);
    s.on('service:created', onRequestCreated);
    s.on('service:updated', onRequest);
    s.on('table:updated', onTable);
    s.on('payment:created', onPayment);
    s.on('settings:updated', onSettings);
    s.on('table:closed', onClosed);
    return () => {
      s.off('connect', join);
      s.off('order:created', onOrderCreated);
      s.off('order:updated', onOrder);
      s.off('service:created', onRequestCreated);
      s.off('service:updated', onRequest);
      s.off('table:updated', onTable);
      s.off('payment:created', onPayment);
      s.off('settings:updated', onSettings);
      s.off('table:closed', onClosed);
    };
  }, [join]);

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
      staffUser,
      logout,
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
      confirmPayment: (tableId, method, cashierName) =>
        run(async () => {
          const s = getSocket();
          const cashier = cashierName || staffUser?.name || staffUser?.username;
          const payment = await request<PaymentDTO | null>((ack) =>
            s.emit('payment:confirm', { tableId, method, cashierName: cashier }, ack),
          );
          if (payment) dispatch({ type: 'payment', payment });
          return payment;
        }),
      updateSettings: (settings: BusinessSettingDTO) => {
        dispatch({ type: 'settings', settings });
      },
    }),
    [state, connected, staffUser, error, run],
  );

  // Si no está autenticado como personal del staff, mostrar pantalla de Login
  if (!staffUser) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-2xl sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Acceso Staff</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa tus credenciales para gestionar el local
            </p>
          </div>

          {loginError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">
              {loginError}
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Usuario</label>
              <input
                required
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value.toLowerCase())}
                placeholder="admin, cocina, caja o mozo"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Contraseña</label>
              <input
                required
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loginLoading}>
              {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Ingresar al Sistema
            </Button>
          </form>

          {/* Accesos rápidos con credenciales por defecto */}
          <div className="space-y-2 border-t pt-4 text-xs">
            <p className="text-center font-semibold text-muted-foreground">
              Credenciales de demostración rápida:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('admin');
                  setLoginPassword('admin123');
                  handleLogin(undefined, 'admin', 'admin123');
                }}
                className="rounded-lg border bg-muted/40 p-2 text-left hover:border-primary hover:bg-muted"
              >
                <div className="font-bold text-foreground">Admin</div>
                <div className="text-[10px] text-muted-foreground">admin / admin123</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('caja');
                  setLoginPassword('caja123');
                  handleLogin(undefined, 'caja', 'caja123');
                }}
                className="rounded-lg border bg-muted/40 p-2 text-left hover:border-primary hover:bg-muted"
              >
                <div className="font-bold text-foreground">Caja</div>
                <div className="text-[10px] text-muted-foreground">caja / caja123</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('cocina');
                  setLoginPassword('cocina123');
                  handleLogin(undefined, 'cocina', 'cocina123');
                }}
                className="rounded-lg border bg-muted/40 p-2 text-left hover:border-primary hover:bg-muted"
              >
                <div className="font-bold text-foreground">Cocina</div>
                <div className="text-[10px] text-muted-foreground">cocina / cocina123</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('mozo');
                  setLoginPassword('mozo123');
                  handleLogin(undefined, 'mozo', 'mozo123');
                }}
                className="rounded-lg border bg-muted/40 p-2 text-left hover:border-primary hover:bg-muted"
              >
                <div className="font-bold text-foreground">Mozo</div>
                <div className="text-[10px] text-muted-foreground">mozo / mozo123</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
