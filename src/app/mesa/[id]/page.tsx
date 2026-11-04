import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TableApp } from '@/components/client/TableApp';
import type { CategoryDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Menu4D — Tu mesa' };

/** Entrada desde el QR: /mesa/:idMesa */
export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) notFound();

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

  return <TableApp initialTable={{ id: table.id, number: table.number, status: table.status }} categories={menu} />;
}

