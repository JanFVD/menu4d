'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppUrl } from '@/components/dashboard/TablesTab';

export function QrSheet({ tables }: { tables: { id: string; number: number }[] }) {
  const appUrl = useAppUrl();

  return (
    <div className="min-h-dvh bg-white p-6 text-black">
      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          URL base: <b>{appUrl}</b> (configurable con NEXT_PUBLIC_APP_URL)
        </p>
        <Button onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {appUrl &&
          tables.map((t) => (
            <div key={t.id} className="flex break-inside-avoid flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 p-6">
              <p className="text-2xl font-black">
                Menu<span className="text-orange-500">4D</span>
              </p>
              <QRCodeSVG value={`${appUrl}/mesa/${t.id}`} size={180} level="M" marginSize={0} />
              <p className="text-3xl font-black">Mesa {t.number}</p>
              <p className="text-center text-xs text-zinc-500">Escaneá para ver la carta y pedir desde tu mesa</p>
            </div>
          ))}
      </div>
    </div>
  );
}

