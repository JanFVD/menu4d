import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { BusinessSettingDTO } from '@/lib/types';

export async function GET() {
  try {
    let settings = await prisma.businessSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.businessSetting.create({
        data: {
          id: 'default',
          name: 'RESTAURANTE EL SABOR PERUANO S.A.C.',
          ruc: '20601234567',
          address: 'Av. José Larco 850, Miraflores, Lima',
          phone: '(01) 445-9876 / 998 123 456',
          logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=240&h=240&q=80',
          ticketFooter: '¡Gracias por su visita!\nComprobante emitido electrónicamente.\nConserve su ticket.',
        },
      });
    }

    const dto: BusinessSettingDTO = {
      id: settings.id,
      name: settings.name,
      ruc: settings.ruc,
      address: settings.address,
      phone: settings.phone,
      logoUrl: settings.logoUrl,
      ticketFooter: settings.ticketFooter,
      appDomain: settings.appDomain,
    };

    return NextResponse.json({ ok: true, settings: dto });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { name, ruc, address, phone, logoUrl, ticketFooter, appDomain } = body;

    const updated = await prisma.businessSetting.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        name: name?.trim() || 'Mi Restaurante',
        ruc: ruc?.trim() || '20123456789',
        address: address?.trim() || '',
        phone: phone?.trim() || '',
        logoUrl: logoUrl?.trim() || null,
        ticketFooter: ticketFooter?.trim() || '',
        appDomain: appDomain?.trim() || '',
      },
      update: {
        ...(name !== undefined && { name: name.trim() }),
        ...(ruc !== undefined && { ruc: ruc.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
        ...(ticketFooter !== undefined && { ticketFooter: ticketFooter.trim() }),
        ...(appDomain !== undefined && { appDomain: appDomain.trim() }),
      },
    });

    const dto: BusinessSettingDTO = {
      id: updated.id,
      name: updated.name,
      ruc: updated.ruc,
      address: updated.address,
      phone: updated.phone,
      logoUrl: updated.logoUrl,
      ticketFooter: updated.ticketFooter,
      appDomain: updated.appDomain,
    };

    return NextResponse.json({ ok: true, settings: dto });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 });
  }
}

