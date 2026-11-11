import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tableInclude, toTableDTO } from '@/lib/server/services';

export async function GET() {
  try {
    const tables = await prisma.table.findMany({
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      include: tableInclude,
    });
    return NextResponse.json({ ok: true, tables: tables.map(toTableDTO) });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json({ error: 'Error al obtener las mesas' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const number = parseInt(body.number, 10);
    const floor = parseInt(body.floor, 10) || 1;

    if (isNaN(number) || number < 1) {
      return NextResponse.json({ error: 'El número de mesa debe ser un entero positivo' }, { status: 400 });
    }

    const existing = await prisma.table.findUnique({ where: { number } });
    if (existing) {
      return NextResponse.json({ error: `La mesa número ${number} ya existe` }, { status: 400 });
    }

    const created = await prisma.table.create({
      data: {
        number,
        floor: Math.max(1, floor),
      },
      include: tableInclude,
    });

    return NextResponse.json({ ok: true, table: toTableDTO(created) });
  } catch (error) {
    console.error('Error creating table:', error);
    return NextResponse.json({ error: 'Error al crear la mesa' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, number, floor } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de mesa requerido' }, { status: 400 });
    }

    const dataToUpdate: Record<string, unknown> = {};

    if (number !== undefined) {
      const num = parseInt(number, 10);
      if (isNaN(num) || num < 1) {
        return NextResponse.json({ error: 'Número de mesa inválido' }, { status: 400 });
      }
      const existing = await prisma.table.findFirst({ where: { number: num, id: { not: id } } });
      if (existing) {
        return NextResponse.json({ error: `La mesa número ${num} ya existe` }, { status: 400 });
      }
      dataToUpdate.number = num;
    }

    if (floor !== undefined) {
      const fl = parseInt(floor, 10);
      dataToUpdate.floor = Math.max(1, isNaN(fl) ? 1 : fl);
    }

    const updated = await prisma.table.update({
      where: { id },
      data: dataToUpdate,
      include: tableInclude,
    });

    return NextResponse.json({ ok: true, table: toTableDTO(updated) });
  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json({ error: 'Error al actualizar la mesa' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de mesa requerido' }, { status: 400 });
    }

    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        orders: { where: { status: { not: 'paid' } } },
        serviceRequests: { where: { status: 'pending' } },
      },
    });

    if (!table) {
      return NextResponse.json({ error: 'La mesa no existe' }, { status: 404 });
    }

    if (table.status === 'occupied' || table.orders.length > 0 || table.serviceRequests.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una mesa que está ocupada o tiene consumos activos' },
        { status: 400 },
      );
    }

    await prisma.table.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json({ error: 'Error al eliminar la mesa' }, { status: 500 });
  }
}

