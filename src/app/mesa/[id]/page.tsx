import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TableApp } from '@/components/client/TableApp';
import type { CategoryDTO, TableDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Menu4D — Tu mesa' };

/** Entrada desde el QR: /mesa/:idMesa */
export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      mergedWithTable: { select: { id: true, number: true } },
      mergedTables: { select: { id: true, number: true } },
    },
  });
  if (!table) notFound();

  // Si esta mesa está unida a otra, redirigir a la mesa principal
  if (table.mergedWithTableId) {
    redirect(`/mesa/${table.mergedWithTableId}`);
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { products: { where: { available: true }, orderBy: { sortOrder: 'asc' } } },
  });

  const menu: CategoryDTO[] = categories
    .filter((c) => c.products.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
      })),
    }));

  const initialTable: TableDTO = {
    id: table.id,
    number: table.number,
    floor: table.floor,
    status: table.status,
    sessionCode: table.sessionCode,
    mergedWithTableId: table.mergedWithTableId,
    mergedTables: table.mergedTables,
  };

  return <TableApp initialTable={initialTable} categories={menu} />;
}
