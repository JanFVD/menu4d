import { prisma } from '@/lib/prisma';
import { QrSheet } from './QrSheet';

export const dynamic = 'force-dynamic';

/** Hoja imprimible de QR: /dashboard/qr (todas) o /dashboard/qr?mesa=<id> (una). */
export default async function QrPage({ searchParams }: { searchParams: Promise<{ mesa?: string }> }) {
  const { mesa } = await searchParams;
  const [tables, settings] = await Promise.all([
    prisma.table.findMany({
      where: mesa ? { id: mesa } : undefined,
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      select: { id: true, number: true, floor: true },
    }),
    prisma.businessSetting.findUnique({
      where: { id: 'default' },
      select: { appDomain: true, name: true, logoUrl: true },
    }),
  ]);

  return <QrSheet tables={tables} configuredDomain={settings?.appDomain ?? null} restaurantName={settings?.name} />;
}
