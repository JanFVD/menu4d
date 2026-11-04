import { prisma } from '@/lib/prisma';
import { QrSheet } from './QrSheet';

export const dynamic = 'force-dynamic';

/** Hoja imprimible de QR: /dashboard/qr (todas) o /dashboard/qr?mesa=<id> (una). */
export default async function QrPage({ searchParams }: { searchParams: Promise<{ mesa?: string }> }) {
  const { mesa } = await searchParams;
  const tables = await prisma.table.findMany({
    where: mesa ? { id: mesa } : undefined,
    orderBy: { number: 'asc' },
    select: { id: true, number: true },
  });
  return <QrSheet tables={tables} />;
}

