'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { BellRing, Check, Printer, QrCode, Receipt, Users } from 'lucide-react';
import { useDashboard } from './DashboardProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useNow } from '@/lib/socket-client';
import { cn, elapsed, formatMoney, PAYMENT_LABELS } from '@/lib/utils';
import type { TableDTO } from '@/lib/types';

export function useAppUrl() {
  const [url, setUrl] = useState(process.env.NEXT_PUBLIC_APP_URL ?? '');
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_APP_URL) setUrl(window.location.origin);
  }, []);
  return url;
}

export function TablesTab() {
  const { tables, orders, requests, resolveRequest } = useDashboard();
  const now = useNow(1000);
  const [qrTable, setQrTable] = useState<TableDTO | null>(null);
  const appUrl = useAppUrl();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Legend className="bg-zinc-600" label="Libre" />
          <Legend className="bg-sky-500" label="Ocupada" />
          <Legend className="bg-amber-500" label="Llamó al mozo" />
          <Legend className="bg-violet-500" label="Pidió la cuenta" />
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/qr" target="_blank">
            <Printer /> Imprimir todos los QR
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {tables.map((t) => {
          const tOrders = orders.filter((o) => o.tableId === t.id);
          const total = tOrders.reduce((a, o) => a + o.total, 0);
          const waiter = requests.find((r) => r.tableId === t.id && r.type === 'call_waiter');
          const bill = requests.find((r) => r.tableId === t.id && r.type === 'request_bill');
          const occupied = t.status === 'occupied';

          return (
            <div
              key={t.id}
              className={cn(
                'relative flex min-h-[170px] flex-col rounded-xl border-2 p-3 transition-colors',
                bill ? 'border-violet-500 bg-violet-500/10' : waiter ? 'border-amber-500 bg-amber-500/10' : occupied ? 'border-sky-500/60 bg-sky-500/5' : 'border-border bg-card',
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Mesa</p>
                  <p className="text-3xl font-black leading-none">{t.number}</p>
                </div>
                <button
                  onClick={() => setQrTable(t)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`QR de la mesa ${t.number}`}
                >
                  <QrCode className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-2 flex-1 space-y-1 text-xs">
                {occupied ? (
                  <>
                    <Badge variant="info">
                      <Users className="h-3 w-3" /> Ocupada
                    </Badge>
                    <p className="text-muted-foreground">
                      {tOrders.length} pedido(s) · <span className="font-semibold text-foreground">{formatMoney(total)}</span>
                    </p>
                  </>
                ) : (
                  <Badge variant="secondary">Libre</Badge>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                {waiter && (
                  <RequestPill tone="amber" icon={<BellRing className="h-3.5 w-3.5 animate-bounce" />} onResolve={() => resolveRequest(waiter.id)}>
                    Mozo · {elapsed(waiter.createdAt, now)}
                  </RequestPill>
                )}
                {bill && (
                  <RequestPill tone="violet" icon={<Receipt className="h-3.5 w-3.5" />} onResolve={() => resolveRequest(bill.id)}>
                    {PAYMENT_LABELS[bill.paymentMethod!]}
                  </RequestPill>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!qrTable} onOpenChange={(o) => !o && setQrTable(null)}>
        <DialogContent className="items-center text-center">
          {qrTable && (
            <>
              <DialogTitle className="pr-0">Mesa {qrTable.number}</DialogTitle>
              <DialogDescription className="break-all">{`${appUrl}/mesa/${qrTable.id}`}</DialogDescription>
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={`${appUrl}/mesa/${qrTable.id}`} size={220} level="M" marginSize={0} />
              </div>
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/mesa/${qrTable.id}`} target="_blank">
                    Abrir vista cliente
                  </Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href={`/dashboard/qr?mesa=${qrTable.id}`} target="_blank">
                    <Printer /> Imprimir
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestPill({
  tone,
  icon,
  children,
  onResolve,
}: {
  tone: 'amber' | 'violet';
  icon: React.ReactNode;
  children: React.ReactNode;
  onResolve: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs font-semibold',
        tone === 'amber' ? 'bg-amber-500 text-black' : 'bg-violet-500 text-white',
      )}
    >
      <span className="flex min-w-0 items-center gap-1 truncate">
        {icon} {children}
      </span>
      <button onClick={onResolve} className="rounded bg-black/20 p-0.5 hover:bg-black/40" aria-label="Marcar como atendida" title="Atendida">
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} /> {label}
    </span>
  );
}

