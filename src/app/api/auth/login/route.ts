import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { StaffRole, StaffUserDTO } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: String(username).trim().toLowerCase() },
    });

    if (!user || user.password !== String(password) || !user.active) {
      return NextResponse.json({ error: 'Credenciales inválidas o usuario inactivo' }, { status: 401 });
    }

    const userDTO: StaffUserDTO = {
      id: user.id,
      username: user.username,
      name: user.name,
      roles: user.roles as StaffRole[],
      active: user.active,
    };

    return NextResponse.json({ ok: true, user: userDTO });
  } catch (error) {
    console.error('Error in login:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

