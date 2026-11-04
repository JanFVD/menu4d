'use client';

import { ChefHat, CircleCheckBig, ClipboardCheck, HandPlatter, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: 'Pedido recibido', icon: ClipboardCheck },
  { label: 'Pedido confirmado', icon: ChefHat },
  { label: 'Pedido en camino', icon: HandPlatter },
  { label: 'Pedido entregado', icon: CircleCheckBig },
];

const HINTS: Record<OrderStatus, string> = {
  received: 'Esperando que el local confirme tu pedido…',
  confirmed: 'Confirmado. Entra a cocina en instantes.',
  cooking: 'La cocina lo está preparando 👨‍🍳',
  on_the_way: '¡Ya está listo! El mozo lo lleva a tu mesa.',
  delivered: '¡Buen provecho!',
  paid: 'Pagado. ¡Gracias!',
};

export function stepIndex(status: OrderStatus) {
  switch (status) {
    case 'received':
      return 0;
    case 'confirmed':
    case 'cooking':
      return 1;
    case 'on_the_way':
      return 2;
    default:
      return 3;
  }
}

/** Rastreador de estado: Recibido → Confirmado → En camino → Entregado */
export function OrderStepper({ status }: { status: OrderStatus }) {
  const current = stepIndex(status);
  const done = status === 'delivered' || status === 'paid';

  return (
    <div className="space-y-3">
      <ol className="flex items-start" aria-label="Estado del pedido">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const completed = i < current || (done && i === current);
          const active = i === current && !done;
          return (
            <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1.5" aria-current={active ? 'step' : undefined}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-1/2 top-5 h-1 w-full -translate-y-1/2 rounded-full transition-colors duration-500',
                    i <= current ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500',
                  completed && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-background text-primary ring-4 ring-primary/25',
                  !completed && !active && 'border-muted bg-background text-muted-foreground',
                )}
              >
                {active && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden />}
                <Icon className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  'px-1 text-center text-[11px] font-medium leading-tight',
                  i <= current ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {HINTS[status]}
      </p>
    </div>
  );
}

