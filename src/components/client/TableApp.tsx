'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BellRing,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  Minus,
  PartyPopper,
  Plus,
  QrCode,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { OrderStepper } from './OrderStepper';
import { getSocket, request, useConnected } from '@/lib/socket-client';
import { cn, formatMoney, PAYMENT_LABELS } from '@/lib/utils';
import {
  PAYMENT_METHODS,
  type CategoryDTO,
  type OrderDTO,
  type PaymentMethod,
  type ProductDTO,
  type ServiceRequestDTO,
  type TableDTO,
  type TableStateDTO,
} from '@/lib/types';

type Cart = Record<string, { quantity: number; notes: string }>;
type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mercado_pago: Wallet,
  credit_card: CreditCard,
  debit_card: CreditCard,
};

export function TableApp({ initialTable, categories }: { initialTable: TableDTO; categories: CategoryDTO[] }) {
  const connected = useConnected();
  const [table, setTable] = useState(initialTable);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [requests, setRequests] = useState<ServiceRequestDTO[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'order' | 'waiter' | 'bill'>(null);
  const [closed, setClosed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeCat, setActiveCat] = useState<string | undefined>(categories[0]?.id);

  // Estados de sesión con PIN de 4 dígitos
  const [needsPin, setNeedsPin] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(initialTable.sessionCode ?? null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  const products = useMemo(() => {
    const m = new Map<string, ProductDTO>();
    categories.forEach((c) => c.products.forEach((p) => m.set(p.id, p)));
    return m;
  }, [categories]);

  const showToast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ------------------------------------------------------------------ Tiempo real
  useEffect(() => {
    const s = getSocket();

    const join = (customPin?: string) => {
      const pinToSend = customPin || sessionStorage.getItem(`menu4d:pin:${initialTable.id}`) || undefined;
      return request<TableStateDTO>((ack) => s.emit('table:join', { tableId: initialTable.id, pin: pinToSend }, ack))
        .then((st) => {
          if (st.needsPin) {
            setNeedsPin(true);
            return;
          }
          setNeedsPin(false);
          setTable(st.table);
          setOrders(st.orders);
          setRequests(st.requests);
          if (st.sessionCode) {
            setSessionCode(st.sessionCode);
            sessionStorage.setItem(`menu4d:pin:${initialTable.id}`, st.sessionCode);
          }
        })
        .catch((e: Error) => showToast(e.message, 'error'));
    };

    const upsertOrder = (o: OrderDTO) =>
      setOrders((prev) => {
        if (o.status === 'paid') return prev.filter((x) => x.id !== o.id);
        return prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [...prev, o];
      });

    const onOrderUpdated = (o: OrderDTO) => {
      upsertOrder(o);
      if (o.status === 'on_the_way') {
        showToast(`¡Pedido #${o.number} en camino a tu mesa!`, 'info');
        navigator.vibrate?.([120, 60, 120]);
      }
    };

    const upsertRequest = (r: ServiceRequestDTO) =>
      setRequests((prev) => {
        if (r.status === 'resolved') return prev.filter((x) => x.id !== r.id);
        return prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
      });

    const onClosed = () => {
      setOrders([]);
      setRequests([]);
      setCart({});
      setCartOpen(false);
      setBillOpen(false);
      setSessionCode(null);
      try {
        sessionStorage.removeItem(`menu4d:pin:${initialTable.id}`);
      } catch {
        /* noop */
      }
      setClosed(true);
      try {
        window.close();
      } catch {
        /* noop */
      }
    };

    if (s.connected) join();
    s.on('connect', join);
    s.on('order:created', upsertOrder);
    s.on('order:updated', onOrderUpdated);
    s.on('service:created', upsertRequest);
    s.on('service:updated', upsertRequest);
    s.on('table:updated', setTable);
    s.on('table:closed', onClosed);
    return () => {
      s.off('connect', join);
      s.off('order:created', upsertOrder);
      s.off('order:updated', onOrderUpdated);
      s.off('service:created', upsertRequest);
      s.off('service:updated', upsertRequest);
      s.off('table:updated', setTable);
      s.off('table:closed', onClosed);
    };
  }, [initialTable.id, showToast]);

  // ------------------------------------------------------------------ Scroll-spy de categorías
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCat(visible[0].target.getAttribute('data-cat') ?? undefined);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories]);

  // ------------------------------------------------------------------ Carrito
  const cartEntries = Object.entries(cart).filter(([id]) => products.has(id));
  const cartCount = cartEntries.reduce((a, [, v]) => a + v.quantity, 0);
  const cartTotal = cartEntries.reduce((a, [id, v]) => a + products.get(id)!.price * v.quantity, 0);

  const changeQty = (productId: string, delta: number) =>
    setCart((prev) => {
      const current = prev[productId]?.quantity ?? 0;
      const quantity = Math.min(50, current + delta);
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = { quantity, notes: prev[productId]?.notes ?? '' };
      return next;
    });

  const setNotes = (productId: string, notes: string) =>
    setCart((prev) => (prev[productId] ? { ...prev, [productId]: { ...prev[productId], notes } } : prev));

  const sendOrder = async () => {
    if (!cartEntries.length) return;
    setBusy('order');
    try {
      const items = cartEntries.map(([productId, v]) => ({ productId, quantity: v.quantity, notes: v.notes.trim() || undefined }));
      const s = getSocket();
      const order = await request<OrderDTO>((ack) => s.emit('order:create', { items }, ack));
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [...prev, order]));
      setCart({});
      setCartOpen(false);
      setClosed(false);
      showToast(`¡Pedido #${order.number} enviado a cocina!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------------ Servicio
  const waiterPending = requests.some((r) => r.type === 'call_waiter');
  const billRequest = requests.find((r) => r.type === 'request_bill');
  const consumed = orders.reduce((a, o) => a + o.total, 0);

  const callWaiter = async () => {
    setBusy('waiter');
    try {
      const s = getSocket();
      await request<ServiceRequestDTO>((ack) => s.emit('service:request', { type: 'call_waiter' }, ack));
      showToast('Avisamos al mozo, ya se acerca 🛎️');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const requestBill = async (paymentMethod: PaymentMethod) => {
    setBusy('bill');
    try {
      const s = getSocket();
      await request<ServiceRequestDTO>((ack) => s.emit('service:request', { type: 'request_bill', paymentMethod }, ack));
      setBillOpen(false);
      showToast(`Cuenta solicitada · ${PAYMENT_LABELS[paymentMethod]}`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const activeOrders = [...orders].reverse();

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length !== 4) return;
    setSubmittingPin(true);
    setPinError(null);
    try {
      const s = getSocket();
      const st = await request<TableStateDTO>((ack) =>
        s.emit('table:join', { tableId: initialTable.id, pin: pinInput }, ack),
      );
      if (st.needsPin) {
        setPinError('Código incorrecto. Verifica los 4 dígitos con la persona que abrió la mesa.');
      } else {
        setNeedsPin(false);
        setTable(st.table);
        setOrders(st.orders);
        setRequests(st.requests);
        if (st.sessionCode) {
          setSessionCode(st.sessionCode);
          sessionStorage.setItem(`menu4d:pin:${initialTable.id}`, st.sessionCode);
        }
      }
    } catch (err) {
      setPinError((err as Error).message);
    } finally {
      setSubmittingPin(false);
    }
  };

  if (needsPin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center animate-fade-in bg-background">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Mesa #{table.number}</h1>
            <span className="inline-block mt-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-semibold">
              Piso {table.floor || 1}
            </span>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Esta mesa ya tiene una sesión iniciada. Pídele el <b>código de 4 dígitos</b> que aparece en la pantalla de tu acompañante para unirte.
            </p>
          </div>

          {pinError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300 font-medium">
              {pinError}
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Código de 4 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinInput(val);
                  setPinError(null);
                }}
                placeholder="• • • •"
                className="w-full rounded-xl border bg-background py-3 text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-bold"
              disabled={pinInput.length !== 4 || submittingPin}
            >
              {submittingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unirme a la mesa'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <QrCode className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">¡Gracias por tu visita!</h1>
        <p className="mt-2 text-base font-bold text-foreground">Mesa #{table.number} liberada</p>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
          El proceso de atención y cobro ha finalizado con éxito y la mesa quedó liberada.
        </p>
        <div className="mt-5 max-w-sm rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-sm font-semibold text-primary">
            Para volver a realizar un pedido, debes volver a escanear el código QR de tu mesa.
          </p>
        </div>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button
            size="lg"
            className="w-full gap-2 font-bold"
            onClick={() => {
              try {
                window.close();
              } catch {
                /* noop */
              }
              window.location.href = '/';
            }}
          >
            Cerrar ventana
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-40">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-black leading-none">
              Menu<span className="text-primary">4D</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-red-500')} />
              Mesa {table.number} · Piso {table.floor || 1}
              {!connected && ' · reconectando…'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setBillOpen(true)} disabled={orders.length === 0}>
            <Receipt /> Pedir la cuenta
          </Button>
        </div>

        {/* Banner de Código de Mesa para compartir con acompañantes */}
        {sessionCode && (
          <div className="flex items-center justify-between border-t bg-amber-500/10 px-4 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-500">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Código:</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-sm tracking-widest text-amber-300">
                {sessionCode}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Comparte con quien se sume a tu mesa
            </span>
          </div>
        )}

        {/* Categorías */}
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Categorías">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => sectionRefs.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                activeCat === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </nav>
      </header>

      {!connected && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <WifiOff className="h-4 w-4" /> Sin conexión. Reintentando…
        </div>
      )}

      {/* Solicitudes activas */}
      {(waiterPending || billRequest) && (
        <div className="mx-4 mt-3 space-y-2">
          {waiterPending && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <BellRing className="h-4 w-4 animate-bounce" /> El mozo fue notificado y ya se acerca.
            </div>
          )}
          {billRequest && (
            <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
              <Receipt className="h-4 w-4" /> Cuenta solicitada · {billRequest.paymentMethod && PAYMENT_LABELS[billRequest.paymentMethod]}
            </div>
          )}
        </div>
      )}

      {/* Seguimiento de pedidos */}
      {activeOrders.length > 0 && (
        <section className="mx-4 mt-4 space-y-3" aria-label="Tus pedidos">
          {activeOrders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-semibold">Pedido #{o.number}</span>
                <span className="text-muted-foreground">
                  {o.items.reduce((a, i) => a + i.quantity, 0)} ítems · {formatMoney(o.total)}
                </span>
              </div>
              <OrderStepper status={o.status} />
            </Card>
          ))}
        </section>
      )}

      {/* Carta */}
      <main className="mt-2 space-y-8 px-4 pt-4">
        {categories.map((c) => (
          <section
            key={c.id}
            data-cat={c.id}
            ref={(el) => {
              sectionRefs.current[c.id] = el;
            }}
            className="scroll-mt-32 space-y-3"
          >
            <h2 className="text-xl font-bold">{c.name}</h2>
            {c.products.map((p) => (
              <ProductRow key={p.id} product={p} quantity={cart[p.id]?.quantity ?? 0} onChange={(d) => changeQty(p.id, d)} />
            ))}
          </section>
        ))}
      </main>

      {/* Botón flotante: Llamar al mozo */}
      <Button
        onClick={callWaiter}
        disabled={busy === 'waiter'}
        className={cn(
          'fixed right-4 z-40 h-14 rounded-full px-5 shadow-xl shadow-black/40 transition-all',
          cartCount > 0 ? 'bottom-24' : 'bottom-6',
          waiterPending ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-secondary text-foreground hover:bg-accent',
        )}
        aria-label="Llamar al mozo"
      >
        {busy === 'waiter' ? <Loader2 className="animate-spin" /> : <BellRing className={cn(waiterPending && 'animate-bounce')} />}
        {waiterPending ? 'Mozo avisado' : 'Llamar al mozo'}
      </Button>

      {/* Barra del carrito */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" className="h-14 w-full justify-between rounded-xl text-base shadow-xl" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag /> Ver pedido
              <Badge variant="secondary" className="bg-black/25 text-white">
                {cartCount}
              </Badge>
            </span>
            <span>{formatMoney(cartTotal)}</span>
          </Button>
        </div>
      )}

      {/* Carrito */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent variant="sheet">
          <DialogTitle>Tu pedido · Mesa {table.number}</DialogTitle>
          <DialogDescription>Revisá los productos y agregá aclaraciones para la cocina.</DialogDescription>
          <div className="-mx-5 flex-1 space-y-4 overflow-y-auto px-5">
            {cartEntries.map(([id, item]) => {
              const p = products.get(id)!;
              return (
                <div key={id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{formatMoney(p.price * item.quantity)}</p>
                    </div>
                    <QtyControl quantity={item.quantity} onChange={(d) => changeQty(id, d)} />
                  </div>
                  <input
                    value={item.notes}
                    onChange={(e) => setNotes(id, e.target.value)}
                    maxLength={200}
                    placeholder="Aclaraciones (ej: sin cebolla, bien cocido)"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(cartTotal)}</span>
          </div>
          <Button size="lg" onClick={sendOrder} disabled={busy === 'order' || !connected || cartCount === 0}>
            {busy === 'order' ? <Loader2 className="animate-spin" /> : <UtensilsCrossed />}
            Enviar pedido a cocina
          </Button>
        </DialogContent>
      </Dialog>

      {/* Pedir la cuenta */}
      <BillDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        orders={orders}
        total={consumed}
        current={billRequest?.paymentMethod ?? null}
        busy={busy === 'bill'}
        onConfirm={requestBill}
      />


      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'fixed left-1/2 top-4 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-fade-in rounded-lg border px-4 py-3 text-sm font-medium shadow-2xl',
            toast.tone === 'ok' && 'border-emerald-500/40 bg-emerald-950 text-emerald-100',
            toast.tone === 'info' && 'border-sky-500/40 bg-sky-950 text-sky-100',
            toast.tone === 'error' && 'border-red-500/40 bg-red-950 text-red-100',
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

// =============================================================================

function ProductRow({ product, quantity, onChange }: { product: ProductDTO; quantity: number; onChange: (delta: number) => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Card className="flex gap-3 overflow-hidden p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-semibold leading-tight">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-bold text-primary">{formatMoney(product.price)}</span>
          {quantity > 0 ? (
            <QtyControl quantity={quantity} onChange={onChange} />
          ) : (
            <Button size="sm" onClick={() => onChange(1)} aria-label={`Agregar ${product.name}`}>
              <Plus /> Agregar
            </Button>
          )}
        </div>
      </div>
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
        )}
      </div>
    </Card>
  );
}

function QtyControl({ quantity, onChange }: { quantity: number; onChange: (delta: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border bg-background p-0.5">
      <button onClick={() => onChange(-1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent" aria-label="Quitar uno">
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums">{quantity}</span>
      <button
        onClick={() => onChange(1)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        aria-label="Agregar uno"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function BillDialog({
  open,
  onOpenChange,
  orders,
  total,
  current,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orders: OrderDTO[];
  total: number;
  current: PaymentMethod | null;
  busy: boolean;
  onConfirm: (m: PaymentMethod) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | null>(current);
  useEffect(() => {
    if (open) setMethod(current);
  }, [open, current]);

  // Agrupa ítems iguales de todas las rondas
  const lines = useMemo(() => {
    const m = new Map<string, { name: string; quantity: number; amount: number }>();
    orders.forEach((o) =>
      o.items.forEach((i) => {
        const l = m.get(i.productId) ?? { name: i.name, quantity: 0, amount: 0 };
        l.quantity += i.quantity;
        l.amount += i.quantity * i.unitPrice;
        m.set(i.productId, l);
      }),
    );
    return [...m.values()];
  }, [orders]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogTitle>Pedir la cuenta</DialogTitle>
        <DialogDescription>Elegí cómo querés pagar y el mozo se acerca con lo necesario.</DialogDescription>

        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm">
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between">
              <span className="text-muted-foreground">
                {l.quantity}× {l.name}
              </span>
              <span>{formatMoney(l.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>

        <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = PAYMENT_ICONS[m];
            const selected = method === m;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={selected}
                onClick={() => setMethod(m)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors',
                  selected ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className={cn('h-5 w-5', selected && 'text-primary')} />
                {PAYMENT_LABELS[m]}
              </button>
            );
          })}
        </div>

        <Button size="lg" disabled={!method || busy} onClick={() => method && onConfirm(method)}>
          {busy ? <Loader2 className="animate-spin" /> : <Receipt />}
          {current ? 'Actualizar solicitud' : 'Solicitar la cuenta'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
