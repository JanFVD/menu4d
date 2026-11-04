'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Image as ImageIcon, Loader2, Receipt, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDashboard } from './DashboardProvider';
import type { BusinessSettingDTO } from '@/lib/types';

export function CompanyTab() {
  const { settings, updateSettings } = useDashboard();
  const [form, setForm] = useState<BusinessSettingDTO>({
    id: 'default',
    name: 'RESTAURANTE EL SABOR PERUANO S.A.C.',
    ruc: '20601234567',
    address: 'Av. José Larco 850, Miraflores, Lima',
    phone: '(01) 445-9876 / 998 123 456',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=240&h=240&q=80',
    ticketFooter: '¡Gracias por su visita!\nComprobante emitido electrónicamente.\nConserve su ticket.',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    } else {
      setLoading(true);
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.settings) {
            setForm(data.settings);
            updateSettings(data.settings);
          }
        })
        .catch(() => setError('Error al cargar la información'))
        .finally(() => setLoading(false));
    }
  }, [settings, updateSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      updateSettings(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Building2 className="h-6 w-6 text-primary" /> Datos de la Empresa y Ticket de Venta
        </h2>
        <p className="text-sm text-muted-foreground">
          Configura los datos fiscales, logotipo y pie de comprobante que aparecerán en el ticket de caja.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Local / Razón Social</CardTitle>
            <CardDescription>Estos datos se imprimen en la cabecera de cada ticket de venta emitido en caja.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Nombre Comercial o Razón Social</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: RESTAURANTE MI PERÚ S.A.C."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">R.U.C. (11 dígitos)</label>
                  <input
                    required
                    maxLength={11}
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '') })}
                    placeholder="20XXXXXXXXX"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Teléfono / WhatsApp</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(01) 445-9876 / 999 888 777"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Dirección Fiscal / Ubicación del Local</label>
                <input
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. José Larco 850, Miraflores, Lima"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">URL del Logo de la Empresa (PNG/JPG)</label>
                <input
                  type="url"
                  value={form.logoUrl || ''}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value || null })}
                  placeholder="https://..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se recomienda una imagen con fondo blanco o transparente.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensaje de Pie de Ticket</label>
                <textarea
                  rows={3}
                  value={form.ticketFooter}
                  onChange={(e) => setForm({ ...form, ticketFooter: e.target.value })}
                  placeholder="¡Gracias por su preferencia!&#10;Conserve este ticket."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Datos de Empresa
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
                    <Check className="h-4 w-4" /> ¡Guardado correctamente!
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Vista previa en vivo del Ticket */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Receipt className="h-4 w-4" /> Vista Previa del Ticket
          </h3>

          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
            <div className="mx-auto max-w-[280px] rounded-lg border border-dashed border-zinc-300 bg-white p-3 font-mono text-[11px] text-black shadow-md">
              {form.logoUrl ? (
                <div className="mb-2 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logoUrl}
                    alt="Logo"
                    className="max-h-12 max-w-[120px] object-contain filter grayscale"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="mb-2 flex justify-center text-zinc-400">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}

              <div className="text-center font-bold uppercase leading-tight">
                {form.name || 'NOMBRE DE EMPRESA'}
              </div>
              <div className="mt-0.5 text-center text-[10px]">R.U.C.: {form.ruc || '20XXXXXXXXX'}</div>
              <div className="text-center text-[9px] leading-tight text-zinc-700">{form.address || 'Dirección fiscal'}</div>
              <div className="text-center text-[9px] text-zinc-700">Telf: {form.phone || 'Teléfono'}</div>

              <div className="my-1.5 border-t border-dashed border-zinc-400" />
              <div className="text-center font-bold text-[10px]">TICKET DE VENTA</div>
              <div className="my-1.5 border-t border-dashed border-zinc-400" />

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>MESA:</span>
                  <span className="font-bold">MESA #04</span>
                </div>
                <div className="flex justify-between">
                  <span>ATENDIDO POR:</span>
                  <span>Cajero</span>
                </div>
              </div>

              <div className="my-1.5 border-t border-dotted border-zinc-400" />

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>1× Lomo Saltado</span>
                  <span className="font-bold">S/ 38.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1× Chicha Morada 1L</span>
                  <span className="font-bold">S/ 14.00</span>
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-zinc-400" />

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between text-zinc-600">
                  <span>SUB-TOTAL:</span>
                  <span>S/ 44.07</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>I.G.V. (18%):</span>
                  <span>S/ 7.93</span>
                </div>
                <div className="flex justify-between font-black text-xs">
                  <span>TOTAL:</span>
                  <span>S/ 52.00</span>
                </div>
              </div>

              <div className="my-2 border-t border-dashed border-zinc-400" />
              <div className="whitespace-pre-line text-center text-[9px] leading-tight text-zinc-600">
                {form.ticketFooter}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

