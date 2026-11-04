import type { Metadata } from 'next';
import { DashboardApp } from '@/components/dashboard/DashboardApp';

export const metadata: Metadata = { title: 'Menu4D — Cocina (KDS)' };

/** KDS a pantalla completa para la tablet/monitor de cocina. */
export default function KitchenPage() {
  return <DashboardApp mode="kitchen" />;
}

