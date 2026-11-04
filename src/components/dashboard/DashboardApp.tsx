'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, ChefHat, LayoutGrid, Volume2, VolumeX, Wallet, X } from 'lucide-react';
import { DashboardProvider, useDashboard } from './DashboardProvider';
import { SummaryTab } from './SummaryTab';
import { TablesTab } from './TablesTab';
import { KitchenBoard } from './KitchenBoard';
import { CashierTab } from './CashierTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardApp({ mode = 'full' }: { mode?: 'full' | 'kitchen' }) {
  const [sound, setSound] = useState(true);
  return (
    <DashboardProvider sound={sound}>
      <div className="min-h-dvh px-4 py-4 lg:px-6">
        <TopBar sound={sound} onToggleSound={() => setSound((s) => !s)} title={mode === 'kitchen' ? 'Cocina' : 'Operaciones'} />
        {mode === 'kitchen' ? <KitchenBoard fullscreen /> : <DashboardTabs />}
      </div>
    </DashboardProvider>
  );
}

function DashboardTabs() {
  const { orders, requests } = useDashboard();
  const newOrders = orders.filter((o) => o.status === 'received').length;
  const bills = requests.filter((r) => r.type === 'request_bill').length;

  return (
    <Tabs defaultValue="summary">
      <TabsList className="no-scrollbar w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="summary">
          <BarChart3 /> Resumen
        </TabsTrigger>
        <TabsTrigger value="tables">
          <LayoutGrid /> Mesas
          {requests.length > 0 && <Badge variant="warning">{requests.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="kitchen">
          <ChefHat /> Cocina
          {newOrders > 0 && <Badge variant="info">{newOrders}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="cashier">
          <Wallet /> Caja
          {bills > 0 && <Badge variant="violet">{bills}</Badge>}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="summary">
        <SummaryTab />
      </TabsContent>
      <TabsContent value="tables">
        <TablesTab />
      </TabsContent>
      <TabsContent value="kitchen">
        <KitchenBoard />
      </TabsContent>
      <TabsContent value="cashier">
        <CashierTab />
      </TabsContent>
    </Tabs>
  );
}

function TopBar({ title, sound, onToggleSound }: { title: string; sound: boolean; onToggleSound: () => void }) {
  const { connected, error, clearError } = useDashboard();
  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-black">
            Menu<span className="text-primary">4D</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'animate-pulse bg-emerald-500' : 'bg-red-500')} />
            {connected ? 'En vivo' : 'Reconectando…'}
          </span>
          <Button variant="ghost" size="icon" onClick={onToggleSound} aria-label={sound ? 'Silenciar alertas' : 'Activar alertas'}>
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </header>
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </span>
          <button onClick={clearError} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

