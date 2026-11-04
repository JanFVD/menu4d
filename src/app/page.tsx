import Link from 'next/link';
import { ChefHat, LayoutDashboard, QrCode } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/** Página de inicio del MVP: accesos rápidos para la demo. */
export default async function Home() {
  const tables = await prisma.table.findMany({ orderBy: { number: 'asc' } }).catch(() => []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight">
          Menu<span className="text-primary">4D</span>
        </h1>
        <p className="text-muted-foreground">Carta digital, comandas y gestión del salón en tiempo real.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard">
            <LayoutDashboard /> Dashboard del local
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/cocina">
            <ChefHat /> Pantalla de cocina (KDS)
          </Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <QrCode className="h-4 w-4" /> Simular escaneo de QR
        </h2>
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay mesas. Ejecutá <code className="rounded bg-muted px-1">npm run db:push && npm run db:seed</code>.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {tables.map((t) => (
              <Button key={t.id} asChild variant="outline">
                <Link href={`/mesa/${t.id}`}>Mesa {t.number}</Link>
              </Button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

