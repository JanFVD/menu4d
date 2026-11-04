'use client';

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatMoney, PAYMENT_LABELS } from '@/lib/utils';
import type { BusinessSettingDTO, PaymentDTO } from '@/lib/types';

interface SalesTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentDTO | null;
  settings?: BusinessSettingDTO;
}

export function SalesTicketDialog({ open, onOpenChange, payment, settings }: SalesTicketDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const total = payment.amount;
  // Cálculo de Subtotal e IGV referencial en Perú (18%)
  const subtotal = Math.round(total / 1.18);
  const igv = total - subtotal;

  const businessName = settings?.name || 'RESTAURANTE EL SABOR PERUANO';
  const ruc = settings?.ruc || '20601234567';
  const address = settings?.address || 'Av. Principal 123, Lima';
  const phone = settings?.phone || '+51 999 888 777';
  const logoUrl = settings?.logoUrl;
  const ticketFooter = settings?.ticketFooter || '¡Gracias por su compra!\nConserve este ticket.';

  const formattedDate = new Date(payment.createdAt).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogTitle className="sr-only">Ticket de Venta</DialogTitle>
        <DialogDescription className="sr-only">Comprobante de venta para imprimir</DialogDescription>

        <div className="flex items-center justify-between border-b pb-3 no-print">
          <h2 className="text-lg font-bold">Ticket de Venta</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenedor del Ticket Térmico (imprimible) */}
        <div className="max-h-[75vh] overflow-y-auto px-1 py-2">
          <div
            id="ticket-print-area"
            ref={printAreaRef}
            className="ticket-paper mx-auto max-w-[320px] rounded-lg border border-dashed border-zinc-400 bg-white p-4 font-mono text-xs text-black shadow-sm"
          >
            {/* Logo de la empresa si está configurado */}
            {logoUrl && (
              <div className="mb-2 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={businessName}
                  className="max-h-16 max-w-[150px] object-contain filter grayscale"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Cabecera */}
            <div className="text-center">
              <h3 className="text-sm font-black uppercase tracking-wider">{businessName}</h3>
              <p className="mt-0.5">R.U.C.: {ruc}</p>
              <p className="mt-0.5 leading-tight">{address}</p>
              <p className="mt-0.5">Telf: {phone}</p>
            </div>

            <div className="my-2 border-t border-dashed border-zinc-400" />

            <div className="text-center font-bold">
              <p className="text-xs uppercase tracking-wide">TICKET DE VENTA</p>
              <p className="text-[10px] text-zinc-600">ID: {payment.id.slice(-8).toUpperCase()}</p>
            </div>

            <div className="my-2 border-t border-dashed border-zinc-400" />

            {/* Metadatos */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>MESA:</span>
                <span>MESA #{payment.tableNumber}</span>
              </div>
              {payment.cashierName && (
                <div className="flex justify-between">
                  <span>ATENDIDO POR:</span>
                  <span>{payment.cashierName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>FORMA DE PAGO:</span>
                <span>{PAYMENT_LABELS[payment.method] || payment.method}</span>
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-zinc-400" />

            {/* Detalle de ítems */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              <div className="border-t border-dotted border-zinc-300" />

              {payment.items && payment.items.length > 0 ? (
                payment.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-semibold leading-tight">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="tabular-nums font-semibold">{formatMoney(it.total)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      P. Unit: {formatMoney(it.unitPrice)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>Consumo general</span>
                  <span className="font-semibold">{formatMoney(total)}</span>
                </div>
              )}
            </div>

            <div className="my-2 border-t border-dashed border-zinc-400" />

            {/* Totales */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between text-zinc-600">
                <span>OP. GRAVADA:</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>I.G.V. (18%):</span>
                <span className="tabular-nums">{formatMoney(igv)}</span>
              </div>
              <div className="flex justify-between text-sm font-black">
                <span>TOTAL A PAGAR:</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-zinc-400" />

            {/* Pie de ticket */}
            <div className="whitespace-pre-line text-center text-[10px] leading-tight text-zinc-700">
              {ticketFooter}
            </div>

            <div className="mt-3 text-center text-[9px] text-zinc-400">
              Powered by Menu4D
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3 no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Imprimir Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

