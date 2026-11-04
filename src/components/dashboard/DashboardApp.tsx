'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChefHat,
  LayoutGrid,
  LogOut,
  UtensilsCrossed,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { DashboardProvider, useDashboard } from './DashboardProvider';
import { SummaryTab } from './SummaryTab';
import { TablesTab } from './TablesTab';
import { KitchenBoard } from './KitchenBoard';
import { CashierTab } from './CashierTab';
import { MenuTab } from './MenuTab';
import { StaffTab } from './StaffTab';
import { CompanyTab } from './CompanyTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/lib/types';

const ROLE_COLORS: Record<StaffRole, 'violet' | 'warning' | 'success' | 'info'> = {
  admin: 'violet',
  cocina: 'warning',
  caja: 'success',
  mozo: 'info',
};

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
  const { orders, requests, staffUser } = useDashboard();
  const newOrders = orders.filter((o) => o.status === 'received').length;
  const bills = requests.filter((r) => r.type === 'request_bill').length;

  const roles = staffUser?.roles || [];
  const isAdmin = roles.includes('admin');
  const canTables = isAdmin || roles.includes('mozo');
  const canKitchen = isAdmin || roles.includes('cocina');
  const canCashier = isAdmin || roles.includes('caja');

  const defaultTab = useMemo(() => {
    if (isAdmin) return 'summary';
    if (canTables) return 'tables';
    if (canKitchen) return 'kitchen';
    if (canCashier) return 'cashier';
    return 'tables';
  }, [isAdmin, canTables, canKitchen, canCashier]);

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="no-scrollbar w-full justify-start overflow-x-auto sm:w-auto">
        {isAdmin && (
          <TabsTrigger value="summary">
            <BarChart3 /> Resumen
          </TabsTrigger>
        )}
        {canTables && (
          <TabsTrigger value="tables">
            <LayoutGrid /> Mesas / Salón
            {requests.length > 0 && <Badge variant="warning">{requests.length}</Badge>}
          </TabsTrigger>
        )}
        {canKitchen && (
          <TabsTrigger value="kitchen">
            <ChefHat /> Cocina
            {newOrders > 0 && <Badge variant="info">{newOrders}</Badge>}
          </TabsTrigger>
        )}
        {canCashier && (
          <TabsTrigger value="cashier">
            <Wallet /> Caja
            {bills > 0 && <Badge variant="violet">{bills}</Badge>}
          </TabsTrigger>
        )}
        {isAdmin && (
          <TabsTrigger value="menu">
            <UtensilsCrossed /> Menú
          </TabsTrigger>
        )}
        {isAdmin && (
          <TabsTrigger value="staff">
            <Users /> Personal / Staff
          </TabsTrigger>
        )}
        {isAdmin && (
          <TabsTrigger value="company">
            <Building2 /> Empresa / Ticket
          </TabsTrigger>
        )}
      </TabsList>

      {isAdmin && (
        <TabsContent value="summary">
          <SummaryTab />
        </TabsContent>
      )}
      {canTables && (
        <TabsContent value="tables">
          <TablesTab />
        </TabsContent>
      )}
      {canKitchen && (
        <TabsContent value="kitchen">
          <KitchenBoard />
        </TabsContent>
      )}
      {canCashier && (
        <TabsContent value="cashier">
          <CashierTab />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="menu">
          <MenuTab />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="staff">
          <StaffTab />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
      )}
    </Tabs>
  );
}

function TopBar({ title, sound, onToggleSound }: { title: string; sound: boolean; onToggleSound: () => void }) {
  const { connected, error, clearError, staffUser, logout } = useDashboard();
  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-black">
            Menu<span className="text-primary">4D</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">{title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {staffUser && (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs">
              <span className="font-semibold">{staffUser.name}</span>
              <div className="flex gap-1">
                {staffUser.roles.map((r) => (
                  <Badge key={r} variant={ROLE_COLORS[r]} className="text-[10px] py-0 px-1.5 uppercase">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'animate-pulse bg-emerald-500' : 'bg-red-500')} />
            {connected ? 'En vivo' : 'Reconectando…'}
          </span>

          <Button variant="ghost" size="icon" onClick={onToggleSound} aria-label={sound ? 'Silenciar alertas' : 'Activar alertas'}>
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>

          {staffUser && (
            <Button variant="outline" size="sm" onClick={logout} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </Button>
          )}
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
