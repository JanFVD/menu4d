import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { StaffRole, StaffUserDTO } from '@/lib/types';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const list: StaffUserDTO[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      roles: u.roles as StaffRole[],
      active: u.active,
    }));

    return NextResponse.json({ ok: true, users: list });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, name, roles } = body;

    if (!username || !password || !name) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'Debe asignar al menos un rol' }, { status: 400 });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      return NextResponse.json({ error: 'El nombre de usuario ya está registrado' }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        password: String(password),
        name: String(name).trim(),
        roles: roles,
        active: true,
      },
    });

    const userDTO: StaffUserDTO = {
      id: user.id,
      username: user.username,
      name: user.name,
      roles: user.roles as StaffRole[],
      active: user.active,
    };

    return NextResponse.json({ ok: true, user: userDTO });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, roles, password, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (name) dataToUpdate.name = String(name).trim();
    if (Array.isArray(roles) && roles.length > 0) dataToUpdate.roles = roles;
    if (password && String(password).trim().length > 0) dataToUpdate.password = String(password);
    if (typeof active === 'boolean') dataToUpdate.active = active;

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    const userDTO: StaffUserDTO = {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      roles: updated.roles as StaffRole[],
      active: updated.active,
    };

    return NextResponse.json({ ok: true, user: userDTO });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Proteger para que no se elimine el último admin
    const admins = await prisma.user.findMany({
      where: { roles: { has: 'admin' }, active: true },
    });

    const toDelete = await prisma.user.findUnique({ where: { id } });
    if (toDelete?.roles.includes('admin') && admins.length <= 1) {
      return NextResponse.json({ error: 'No se puede eliminar al único administrador del sistema' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}

