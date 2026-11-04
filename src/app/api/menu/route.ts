import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json({ error: 'Error al obtener el menú' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === 'category') {
      const { name } = body;
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Nombre de categoría requerido' }, { status: 400 });
      }

      const count = await prisma.category.count();
      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          sortOrder: count,
        },
      });
      return NextResponse.json({ ok: true, category });
    }

    if (type === 'product') {
      const { name, description, price, categoryId, imageUrl, available } = body;
      if (!name?.trim() || !categoryId || price == null) {
        return NextResponse.json({ error: 'Nombre, categoría y precio son obligatorios' }, { status: 400 });
      }

      const count = await prisma.product.count({ where: { categoryId } });
      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          description: description?.trim() ?? '',
          price: Math.max(0, Math.round(Number(price))),
          categoryId,
          imageUrl: imageUrl?.trim() || null,
          available: available ?? true,
          sortOrder: count,
        },
      });
      return NextResponse.json({ ok: true, product });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json({ error: 'Error al crear elemento' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { type, id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    if (type === 'category') {
      const { name } = body;
      const category = await prisma.category.update({
        where: { id },
        data: {
          name: name?.trim(),
        },
      });
      return NextResponse.json({ ok: true, category });
    }

    if (type === 'product') {
      const { name, description, price, categoryId, imageUrl, available } = body;
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (price !== undefined) updateData.price = Math.max(0, Math.round(Number(price)));
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
      if (available !== undefined) updateData.available = Boolean(available);

      const product = await prisma.product.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json({ ok: true, product });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Error al actualizar elemento' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!id || !type) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    if (type === 'category') {
      // Check if products exist
      const productCount = await prisma.product.count({ where: { categoryId: id } });
      if (productCount > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar una categoría con productos asociados. Elimina o mueve los productos primero.' },
          { status: 400 }
        );
      }
      await prisma.category.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (type === 'product') {
      await prisma.product.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json({ error: 'Error al eliminar elemento' }, { status: 500 });
  }
}

