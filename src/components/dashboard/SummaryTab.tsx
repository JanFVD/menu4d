'use client';

import { useMemo } from 'react';
import { BellRing, CircleDollarSign, ClipboardList, Hourglass, LayoutGrid, Receipt, Wallet } from 'lucide-react';
import { useDashboard } from './DashboardProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/lib/socket-client';
import { cn, elapsed, formatMoney, ORDER_STATUS_LABELS, PAYMENT_LABELS } from '@/lib/utils';

export function SummaryTab() {
  const { tables, orders, requests, payments } = useDashboard();
  const now = useNow(1000);

  const m = useMemo(() => {
    const occupied = tables.filter((t) => t.status === 'occupied').length;
    return {
      sales: payments.reduce((a, p) => a + p.amount, 0),
      tickets: payments.length,
      unconfirmed: orders.filter((o) => o.status === 'received').length,
      active: orders.filter((o) => ['received', 'confirmed', 'cooking', 'on_the_way'].includes(o.status)).length,
      receivable: orders.reduce((a, o) => a + o.total, 0),
      occupied,
      free: tables.length - occupied,
    };
  }, [tables, orders, payments]);

  const occupancy = tables.length ? Math.round((m.occupied / tables.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Ventas del turno" value={formatMoney(m.sales)} hint={`${m.tickets} cobros`} tone="text-emerald-400" />
        <Metric
          icon={Hourglass}
          label="Pedidos sin confirmar"
          value={String(m.unconfirmed)}
          hint={`${m.active} pedidos activos`}
          tone={m.unconfirmed > 0 ? 'text-amber-400' : 'text-foreground'}
          pulse={m.unconfirmed > 0}
        />
        <Metric icon={LayoutGrid} label="Mesas ocupadas" value={`${m.occupied} / ${tables.length}`} hint={`${m.free} libres · ${occupancy}%`} tone="text-sky-400">
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${occupancy}%` }} />
          </div>
        </Metric>
        <Metric icon={Wallet} label="Por cobrar (abierto)" value={formatMoney(m.receivable)} hint="Consumo en mesas" tone="text-violet-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-400" /> Solicitudes del salón
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes pendientes.</p>}
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {r.type === 'call_waiter' ? <BellRing className="h-4 w-4 text-amber-400" /> : <Receipt className="h-4 w-4 text-violet-300" />}
                  Mesa {r.tableNumber} · {r.type === 'call_waiter' ? 'Llamó al mozo' : `Pidió la cuenta (${PAYMENT_LABELS[r.paymentMethod!]})`}
                </span>
                <span className="font-mono text-muted-foreground">{elapsed(r.createdAt, now)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-sky-400" /> Pedidos abiertos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {orders.length === 0 && <p className="text-sm text-muted-foreground">No hay pedidos abiertos.</p>}
            {[...orders].reverse().slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span>
                  <b>Mesa {o.tableNumber}</b> <span className="text-muted-foreground">#{o.number}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatMoney(o.total)}</span>
                  <Badge variant={o.status === 'received' ? 'warning' : o.status === 'delivered' ? 'success' : 'info'}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  pulse,
  children,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  tone: string;
  pulse?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className={cn('h-5 w-5', tone, pulse && 'animate-pulse')} />
      </div>
      <p className={cn('mt-2 text-3xl font-black tabular-nums', tone)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {children}
    </Card>
  );
}

