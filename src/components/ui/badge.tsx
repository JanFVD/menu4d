import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground',
      success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      warning: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
      danger: 'border-red-500/30 bg-red-500/15 text-red-400',
      info: 'border-sky-500/30 bg-sky-500/15 text-sky-400',
      violet: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

