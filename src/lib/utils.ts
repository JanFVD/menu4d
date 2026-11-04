import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { OrderStatus, PaymentMethod } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Formatea centavos → "$ 12.500" */
export function formatMoney(cents: number) {
  return money.format(Math.round(cents / 100));
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  mercado_pago: 'Mercado Pago / Billetera',
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recibido',
  confirmed: 'Confirmado',
  cooking: 'En cocina',
  on_the_way: 'En camino',
  delivered: 'Entregado',
  paid: 'Pagado',
};

/** mm:ss (o h:mm:ss) transcurrido desde `iso` */
export function elapsed(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function minutesSince(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / 60000;
}

/** Sonido corto de notificación (WebAudio, sin assets). Falla en silencio si el navegador lo bloquea. */
export function playChime(freq = 880) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    /* noop */
  }
}

