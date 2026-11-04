'use client';

import { useState } from 'react';
import { Check, ChefHat, Clock, Flame, HandPlatter, Inbox, Loader2, MessageSquareWarning } from 'lucide-react';
import { useDashboard } from './DashboardProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/lib/socket-client';
import { cn, elapsed, minutesSince } from '@/lib/utils';
import type { OrderDTO, OrderStatus } from '@/lib/types';

/** Umbrales del semáforo de tiempos (minutos). */
const WARN_MIN = 10;
const LATE_MIN = 20;

const COLUMNS: { key: string; title: string; icon: typeof Inbox; statuses: OrderStatus[]; accent: string }[] = [
  { key: 'new', title: 'Nuevas', icon: Inbox, statuses: ['received'], accent: 'text-sky-400' },
  { key: 'prep', title: 'En preparación', icon: Flame, statuses: ['confirmed', 'cooking'], accent: 'text-orange-400' },
  { key: 'ready', title: 'Listas para servir', icon: HandPlatter, statuses: ['on_the_way'], accent: 'text-emerald-400' },
];

/** Kitchen Display System: Kanban de comandas con temporizadores. */
export function KitchenBoard({ fullscreen = false }: { fullscreen?: boolean }) {
  const { orders } = useDashboard();
  const now = useNow(1000);

  return (
    <div className={cn('grid gap-4 lg:grid-cols-3', fullscreen && 'h-[calc(100dvh-5rem)]')}>
      {COLUMNS.map((col) => {
        const list = orders
          .filter((o) => col.statuses.includes(o.status))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO: la más vieja primero
        const Icon = col.icon;
        return (
          <section key={col.key} className="flex min-h-[200px] flex-col rounded-xl border bg-muted/30" aria-label={col.title}>
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className={cn('flex items-center gap-2 font-bold', col.accent)}>
                <Icon className="h-5 w-5" /> {col.title}
              </h2>
              <Badge variant="secondary">{list.length}</Badge>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Sin comandas</p>}
              {list.map((o) => (
                <TicketCard key={o.id} order={o} now={now} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TicketCard({ order, now }: { order: OrderDTO; now: number }) {
  const { updateOrderStatus } = useDashboard();
  const [pending, setPending] = useState<OrderStatus | null>(null);

  // En "Listas" medimos cuánto hace que espera el mozo; en el resto, desde que entró la comanda.
  const since = order.status === 'on_the_way' && order.readyAt ? order.readyAt : order.createdAt;
  const mins = minutesSince(since, now);
  const late = order.status !== 'on_the_way' && mins >= LATE_MIN;
  const warn = order.status !== 'on_the_way' && mins >= WARN_MIN && !late;

  const advance = async (status: OrderStatus) => {
    setPending(status);
    try {
      await updateOrderStatus(order.id, status);
    } catch {
      /* el provider muestra el error */
    } finally {
      setPending(null);
    }
  };

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border-2 bg-card shadow-lg transition-colors',
        late ? 'border-red-500' : warn ? 'border-amber-500' : 'border-border',
        order.status === 'received' && 'animate-fade-in',
      )}
    >
      <header
        className={cn(
          'flex items-center justify-between px-3 py-2',
          late ? 'bg-red-500/20' : warn ? 'bg-amber-500/15' : 'bg-muted/60',
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black">Mesa {order.tableNumber}</span>
          <span className="text-xs text-muted-foreground">#{order.number}</span>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 font-mono text-lg font-bold tabular-nums',
            late ? 'animate-pulse text-red-400' : warn ? 'text-amber-400' : 'text-emerald-400',
          )}
          title={order.status === 'on_the_way' ? 'Esperando al mozo' : 'Tiempo desde que entró la comanda'}
        >
          <Clock className="h-4 w-4" />
          {elapsed(since, now)}
        </span>
      </header>

      <ul className="space-y-2 px-3 py-3">
        {order.items.map((i) => (
          <li key={i.id}>
            <div className="flex gap-2 text-base">
              <span className="min-w-[2ch] font-black text-primary">{i.quantity}×</span>
              <span className="font-semibold">{i.name}</span>
            </div>
            {i.notes && (
              <p className="ml-7 mt-0.5 flex items-start gap-1 text-sm italic text-amber-300">
                <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {i.notes}
              </p>
            )}
          </li>
        ))}
      </ul>

      <footer className="flex gap-2 border-t p-2">
        {order.status === 'received' && (
          <Button className="h-12 flex-1 text-base" onClick={() => advance('confirmed')} disabled={!!pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Confirmar
          </Button>
        )}
        {order.status === 'confirmed' && (
          <Button variant="secondary" className="h-12" onClick={() => advance('cooking')} disabled={!!pending}>
            {pending === 'cooking' ? <Loader2 className="animate-spin" /> : <ChefHat />} Cocinar
          </Button>
        )}
        {(order.status === 'confirmed' || order.status === 'cooking') && (
          <Button variant="success" className="h-12 flex-1 text-base" onClick={() => advance('on_the_way')} disabled={!!pending}>
            {pending === 'on_the_way' ? <Loader2 className="animate-spin" /> : <Check />} Listo
          </Button>
        )}
        {order.status === 'on_the_way' && (
          <Button variant="outline" className="h-12 flex-1 text-base" onClick={() => advance('delivered')} disabled={!!pending}>
            {pending ? <Loader2 className="animate-spin" /> : <HandPlatter />} Entregado en mesa
          </Button>
        )}
      </footer>
      {order.status === 'cooking' && (
        <div className="bg-orange-500/10 px-3 py-1 text-center text-xs font-medium text-orange-300">En cocina</div>
      )}
    </article>
  );
}

