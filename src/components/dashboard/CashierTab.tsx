'use client';

import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Loader2, Printer, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { useDashboard } from './DashboardProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesTicketDialog } from './SalesTicketDialog';
import { cn, formatMoney, PAYMENT_LABELS } from '@/lib/utils';
import { PAYMENT_METHODS, type OrderDTO, type PaymentDTO, type PaymentMethod, type TableDTO } from '@/lib/types';

const ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mercado_pago: Wallet,
  credit_card: CreditCard,
  debit_card: CreditCard,
};

export function CashierTab() {
  const { tables, orders, requests, payments, settings } = useDashboard();
  const [ticketPayment, setTicketPayment] = useState<PaymentDTO | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  // Mesas con consumo abierto; primero las que pidieron la cuenta.
  const open = useMemo(() => {
    return tables
      .map((t) => ({
        table: t,
        orders: orders.filter((o) => o.tableId === t.id),
        bill: requests.find((r) => r.tableId === t.id && r.type === 'request_bill') ?? null,
      }))
      .filter((x) => x.orders.length > 0 || x.bill || x.table.status === 'occupied')
      .sort((a, b) => Number(!!b.bill) - Number(!!a.bill) || a.table.number - b.table.number);
  }, [tables, orders, requests]);

  const byMethod = useMemo(() => {
    const totals = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { amount: 0, count: 0 }])) as Record<
      PaymentMethod,
      { amount: number; count: number }
    >;
    payments.forEach((p) => {
      totals[p.method].amount += p.amount;
      totals[p.method].count += 1;
    });
    return totals;
  }, [payments]);

  const total = payments.reduce((a, p) => a + p.amount, 0);

  const handleShowTicket = (payment: PaymentDTO) => {
    setTicketPayment(payment);
    setTicketOpen(true);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Receipt className="h-5 w-5 text-violet-300" /> Cuentas abiertas
        </h2>
        {open.length === 0 && <p className="text-sm text-muted-foreground">No hay mesas con consumo abierto.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {open.map(({ table, orders: tOrders, bill }) => (
            <CheckoutCard
              key={table.id}
              table={table}
              orders={tOrders}
              requested={bill?.paymentMethod ?? null}
              onPaid={handleShowTicket}
            />
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cobros del turno</CardTitle>
            <p className="text-3xl font-black text-emerald-400">{formatMoney(total)}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYMENT_METHODS.map((m) => {
              const Icon = ICONS[m];
              const pct = total ? (byMethod[m].amount / total) * 100 : 0;
              return (
                <div key={m} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" /> {PAYMENT_LABELS[m]}
                      <span className="text-xs text-muted-foreground">({byMethod[m].count})</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(byMethod[m].amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos cobros</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {payments.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay cobros.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 text-sm last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <b className="font-bold">Mesa #{p.tableNumber}</b>
                    <span className="text-xs text-muted-foreground">{PAYMENT_LABELS[p.method]}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    {p.cashierName && ` · ${p.cashierName}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleShowTicket(p)}
                    title="Imprimir ticket de venta"
                  >
                    <Printer className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>

      {/* Modal Ticket de Venta */}
      <SalesTicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        payment={ticketPayment}
        settings={settings}
      />
    </div>
  );
}

function CheckoutCard({
  table,
  orders,
  requested,
  onPaid,
}: {
  table: TableDTO;
  orders: OrderDTO[];
  requested: PaymentMethod | null;
  onPaid: (p: PaymentDTO) => void;
}) {
  const { confirmPayment } = useDashboard();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = method ?? requested ?? 'cash';
  const total = orders.reduce((a, o) => a + o.total, 0);
  const notDelivered = orders.filter((o) => o.status !== 'delivered').length;

  const lines = useMemo(() => {
    const m = new Map<string, { name: string; quantity: number; amount: number; unitPrice: number }>();
    orders.forEach((o) =>
      o.items.forEach((i) => {
        const l = m.get(i.productId) ?? { name: i.name, quantity: 0, amount: 0, unitPrice: i.unitPrice };
        l.quantity += i.quantity;
        l.amount += i.quantity * i.unitPrice;
        m.set(i.productId, l);
      }),
    );
    return [...m.values()];
  }, [orders]);

  const confirm = async () => {
    const msg = notDelivered
      ? `Hay ${notDelivered} pedido(s) sin entregar. ¿Cobrar ${formatMoney(total)} y liberar la mesa ${table.number}?`
      : `¿Confirmar cobro de ${formatMoney(total)} (${PAYMENT_LABELS[selected]}) y liberar la mesa ${table.number}?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const payment = await confirmPayment(table.id, selected);
      if (payment) {
        onPaid(payment);
      } else if (total > 0) {
        // Fallback local si payment era null
        onPaid({
          id: 'pay_' + Date.now(),
          tableId: table.id,
          tableNumber: table.number,
          method: selected,
          amount: total,
          items: lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.amount,
          })),
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      /* error mostrado por el provider */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn('flex flex-col', requested && 'border-violet-500/70')}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl">Mesa {table.number}</CardTitle>
        {requested ? <Badge variant="violet">Pidió la cuenta</Badge> : <Badge variant="secondary">Consumiendo</Badge>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="space-y-1 text-sm">
          {lines.length === 0 && <p className="text-muted-foreground">Sin consumo registrado.</p>}
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between">
              <span className="text-muted-foreground">
                {l.quantity}× {l.name}
              </span>
              <span className="tabular-nums">{formatMoney(l.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t pt-2 text-lg font-black">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PAYMENT_METHODS.map((m) => {
            const Icon = ICONS[m];
            return (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                  selected === m ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{PAYMENT_LABELS[m]}</span>
                {requested === m && <span className="ml-auto text-[10px] text-violet-300">cliente</span>}
              </button>
            );
          })}
        </div>

        <Button variant="success" className="mt-auto" onClick={confirm} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {total > 0 ? 'Confirmar cobro, imprimir ticket y liberar mesa' : 'Liberar mesa'}
        </Button>
      </CardContent>
    </Card>
  );
}
