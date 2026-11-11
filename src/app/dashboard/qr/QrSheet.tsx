'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QrTable {
  id: string;
  number: number;
  floor?: number;
}

export function QrSheet({
  tables,
  configuredDomain,
  restaurantName,
}: {
  tables: QrTable[];
  configuredDomain?: string | null;
  restaurantName?: string;
}) {
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

  const appUrl = useMemo(() => {
    if (configuredDomain && configuredDomain.trim().length > 0) {
      return configuredDomain.trim().replace(/\/$/, '');
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }, [configuredDomain]);

  const floors = useMemo(() => {
    const set = new Set<number>();
    tables.forEach((t) => set.add(t.floor || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (selectedFloor === 'all') return tables;
    return tables.filter((t) => (t.floor || 1) === selectedFloor);
  }, [tables, selectedFloor]);

  return (
    <div className="min-h-dvh bg-white p-6 text-black">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold">Impresión de Códigos QR</h1>
          <p className="text-sm text-zinc-600">
            Dominio codificado: <b className="text-orange-600">{appUrl}</b>{' '}
            {configuredDomain ? '(Configurado en Empresa/Ticket)' : '(Predeterminado del navegador)'}
          </p>
        </div>

        {/* Filtro de piso para imprimir */}
        <div className="flex items-center gap-2">
          {floors.length > 1 && (
            <div className="flex gap-1 rounded-lg border bg-zinc-100 p-1 text-xs">
              <button
                onClick={() => setSelectedFloor('all')}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition-colors',
                  selectedFloor === 'all' ? 'bg-black text-white font-bold' : 'text-zinc-600 hover:text-black',
                )}
              >
                Todos los pisos
              </button>
              {floors.map((fl) => (
                <button
                  key={fl}
                  onClick={() => setSelectedFloor(fl)}
                  className={cn(
                    'rounded px-2.5 py-1 font-medium transition-colors',
                    selectedFloor === fl ? 'bg-black text-white font-bold' : 'text-zinc-600 hover:text-black',
                  )}
                >
                  Piso {fl}
                </button>
              ))}
            </div>
          )}

          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir ({filteredTables.length} mesas)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {filteredTables.map((t) => (
          <div
            key={t.id}
            className="flex break-inside-avoid flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-400 p-6 text-center"
          >
            <p className="text-xl font-black uppercase tracking-tight text-zinc-800">
              {restaurantName || (
                <>
                  Menu<span className="text-orange-500">4D</span>
                </>
              )}
            </p>
            <div className="rounded-xl bg-white p-2">
              <QRCodeSVG value={`${appUrl}/mesa/${t.id}`} size={170} level="M" marginSize={0} />
            </div>
            <div>
              <p className="text-3xl font-black">Mesa {t.number}</p>
              <span className="inline-block rounded-full bg-zinc-200 px-3 py-0.5 text-xs font-bold text-zinc-700">
                Piso {t.floor || 1}
              </span>
            </div>
            <p className="text-xs text-zinc-500">Escanea con tu celular para ver la carta y pedir</p>
          </div>
        ))}
      </div>
    </div>
  );
}
