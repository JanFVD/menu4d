'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  BellRing,
  Check,
  Edit2,
  KeyRound,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Trash2,
  Unlink,
  Users,
  XCircle,
} from 'lucide-react';
import { useDashboard } from './DashboardProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useNow } from '@/lib/socket-client';
import { cn, elapsed, formatMoney, PAYMENT_LABELS } from '@/lib/utils';
import type { TableDTO } from '@/lib/types';

export function useAppUrl() {
  const { settings } = useDashboard();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (settings?.appDomain && settings.appDomain.trim().length > 0) {
      setUrl(settings.appDomain.trim().replace(/\/$/, ''));
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      setUrl(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
    } else if (typeof window !== 'undefined') {
      setUrl(window.location.origin);
    }
  }, [settings?.appDomain]);

  return url || (typeof window !== 'undefined' ? window.location.origin : '');
}

export function TablesTab() {
  const {
    tables,
    orders,
    requests,
    resolveRequest,
    cancelSession,
    mergeTables,
    unmergeTable,
    refreshSnapshot,
    staffUser,
  } = useDashboard();
  const now = useNow(1000);
  const appUrl = useAppUrl();

  // Filtro de pisos
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

  // Modales
  const [qrTable, setQrTable] = useState<TableDTO | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableDTO | null>(null);
  const [formNumber, setFormNumber] = useState('');
  const [formFloor, setFormFloor] = useState('1');
  const [savingTable, setSavingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  // Modal para unir mesas
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [primaryTableForMerge, setPrimaryTableForMerge] = useState<TableDTO | null>(null);
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  // Pisos únicos disponibles
  const floors = useMemo(() => {
    const set = new Set<number>();
    tables.forEach((t) => set.add(t.floor || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (selectedFloor === 'all') return tables;
    return tables.filter((t) => (t.floor || 1) === selectedFloor);
  }, [tables, selectedFloor]);

  // Manejo de Agregar / Editar Mesa
  const openAddTable = () => {
    const maxNum = tables.reduce((acc, t) => Math.max(acc, t.number), 0);
    setEditingTable(null);
    setFormNumber(String(maxNum + 1));
    setFormFloor(selectedFloor !== 'all' ? String(selectedFloor) : '1');
    setTableError(null);
    setManageModalOpen(true);
  };

  const openEditTable = (t: TableDTO) => {
    setEditingTable(t);
    setFormNumber(String(t.number));
    setFormFloor(String(t.floor || 1));
    setTableError(null);
    setManageModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTable(true);
    setTableError(null);
    try {
      const isEdit = Boolean(editingTable);
      const res = await fetch('/api/tables', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTable?.id,
          number: formNumber,
          floor: formFloor,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setManageModalOpen(false);
      await refreshSnapshot();
    } catch (err) {
      setTableError((err as Error).message);
    } finally {
      setSavingTable(false);
    }
  };

  const handleDeleteTable = async (t: TableDTO) => {
    if (!confirm(`¿Eliminar la Mesa ${t.number}?`)) return;
    try {
      const res = await fetch(`/api/tables?id=${t.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await refreshSnapshot();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Manejo de Cancelar Sesión (Liberar mesa vacía)
  const handleCancelSession = async (t: TableDTO) => {
    if (!confirm(`¿Cancelar la sesión activa de la Mesa ${t.number} y liberarla?`)) return;
    try {
      await cancelSession(t.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Manejo de Unir / Separar Mesas
  const openMergeModal = (t: TableDTO) => {
    setPrimaryTableForMerge(t);
    const candidate = tables.find((o) => o.id !== t.id && !o.mergedWithTableId);
    setSelectedSecondaryId(candidate?.id || '');
    setMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!primaryTableForMerge || !selectedSecondaryId) return;
    try {
      setMerging(true);
      await mergeTables(primaryTableForMerge.id, selectedSecondaryId);
      setMergeModalOpen(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setMerging(false);
    }
  };

  const handleUnmerge = async (t: TableDTO) => {
    if (!confirm(`¿Separar la unión de la Mesa ${t.number}?`)) return;
    try {
      await unmergeTable(t.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const isAdmin = staffUser?.roles.includes('admin');

  return (
    <div className="space-y-4">
      {/* Barra superior de controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Selector de pisos */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1">
          <button
            onClick={() => setSelectedFloor('all')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
              selectedFloor === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            Todos los pisos ({tables.length})
          </button>
          {floors.map((fl) => {
            const count = tables.filter((t) => (t.floor || 1) === fl).length;
            return (
              <button
                key={fl}
                onClick={() => setSelectedFloor(fl)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                  selectedFloor === fl ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                Piso {fl} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openAddTable} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar Mesa
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/qr" target="_blank" className="gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir QRs
            </Link>
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Legend className="bg-zinc-600" label="Libre" />
        <Legend className="bg-sky-500" label="Ocupada / Sesión activa" />
        <Legend className="bg-amber-500" label="Llamó al mozo" />
        <Legend className="bg-violet-500" label="Pidió la cuenta" />
      </div>

      {/* Grilla de Mesas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {filteredTables.map((t) => {
          const tOrders = orders.filter((o) => o.tableId === t.id);
          const total = tOrders.reduce((a, o) => a + o.total, 0);
          const waiter = requests.find((r) => r.tableId === t.id && r.type === 'call_waiter');
          const bill = requests.find((r) => r.tableId === t.id && r.type === 'request_bill');
          const occupied = t.status === 'occupied' || Boolean(t.sessionCode);
          const isMergedChild = Boolean(t.mergedWithTableId);
          const isMergedParent = Boolean(t.mergedTables && t.mergedTables.length > 0);

          return (
            <div
              key={t.id}
              className={cn(
                'relative flex min-h-[200px] flex-col rounded-xl border-2 p-3 transition-colors',
                bill
                  ? 'border-violet-500 bg-violet-500/10'
                  : waiter
                    ? 'border-amber-500 bg-amber-500/10'
                    : occupied
                      ? 'border-sky-500/60 bg-sky-500/5'
                      : 'border-border bg-card',
              )}
            >
              {/* Header de la mesa */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Mesa</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                      Piso {t.floor || 1}
                    </span>
                  </div>
                  <p className="text-3xl font-black leading-none">{t.number}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditTable(t)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Editar mesa o cambiar de piso"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setQrTable(t)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`QR de la mesa ${t.number}`}
                    title="Ver Código QR"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Badges de unión */}
              {isMergedChild && (
                <div className="mt-1.5 flex items-center justify-between rounded bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  <span className="flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Unida a Mesa {t.mergedWithTableNumber}
                  </span>
                  <button onClick={() => handleUnmerge(t)} title="Separar mesa" className="hover:text-white">
                    <Unlink className="h-3 w-3" />
                  </button>
                </div>
              )}
              {isMergedParent && (
                <div className="mt-1.5 flex items-center justify-between rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  <span className="flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Incluye Mesa(s): {t.mergedTables?.map((m) => m.number).join(', ')}
                  </span>
                  <button onClick={() => handleUnmerge(t)} title="Separar todas las mesas" className="hover:text-white">
                    <Unlink className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Estado y PIN de 4 dígitos */}
              <div className="mt-2 flex-1 space-y-1.5 text-xs">
                {occupied ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="info">
                        <Users className="h-3 w-3" /> Ocupada
                      </Badge>
                      {t.sessionCode && (
                        <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                          <KeyRound className="h-3 w-3" /> {t.sessionCode}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {tOrders.length} pedido(s) · <span className="font-semibold text-foreground">{formatMoney(total)}</span>
                    </p>
                  </>
                ) : (
                  <Badge variant="secondary">Libre</Badge>
                )}
              </div>

              {/* Solicitudes de servicio */}
              <div className="mt-2 space-y-1.5">
                {waiter && (
                  <RequestPill tone="amber" icon={<BellRing className="h-3.5 w-3.5 animate-bounce" />} onResolve={() => resolveRequest(waiter.id)}>
                    Mozo · {elapsed(waiter.createdAt, now)}
                  </RequestPill>
                )}
                {bill && (
                  <RequestPill tone="violet" icon={<Receipt className="h-3.5 w-3.5" />} onResolve={() => resolveRequest(bill.id)}>
                    {PAYMENT_LABELS[bill.paymentMethod!]}
                  </RequestPill>
                )}
              </div>

              {/* Botones de acción del Mozo */}
              <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2 text-xs">
                {!isMergedChild && (
                  <button
                    onClick={() => openMergeModal(t)}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-muted/60 py-1 text-[11px] font-medium hover:bg-muted"
                    title="Unir con otra mesa"
                  >
                    <LinkIcon className="h-3 w-3" /> Unir
                  </button>
                )}
                {occupied && (
                  <button
                    onClick={() => handleCancelSession(t)}
                    className="flex items-center justify-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
                    title="Liberar mesa y cancelar sesión activa"
                  >
                    <XCircle className="h-3 w-3" /> Liberar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Ver / Probar QR */}
      <Dialog open={!!qrTable} onOpenChange={(o) => !o && setQrTable(null)}>
        <DialogContent className="items-center text-center">
          {qrTable && (
            <>
              <DialogTitle className="pr-0">
                Mesa #{qrTable.number} (Piso {qrTable.floor || 1})
              </DialogTitle>
              <DialogDescription className="break-all">{`${appUrl}/mesa/${qrTable.id}`}</DialogDescription>
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={`${appUrl}/mesa/${qrTable.id}`} size={220} level="M" marginSize={0} />
              </div>
              {qrTable.sessionCode && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-center text-xs text-amber-300">
                  Código de sesión activa: <b>{qrTable.sessionCode}</b>
                </div>
              )}
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/mesa/${qrTable.id}`} target="_blank">
                    Abrir vista cliente
                  </Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href={`/dashboard/qr?mesa=${qrTable.id}`} target="_blank">
                    <Printer /> Imprimir QR
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Agregar / Editar Mesa */}
      <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogTitle>{editingTable ? 'Modificar Mesa' : 'Agregar Nueva Mesa'}</DialogTitle>
          <DialogDescription>Indica el número de mesa y el piso al que pertenece.</DialogDescription>

          {tableError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {tableError}
            </div>
          )}

          <form onSubmit={handleSaveTable} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Número de Mesa</label>
              <input
                required
                type="number"
                min="1"
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                placeholder="Ej: 13"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Piso / Nivel</label>
              <input
                required
                type="number"
                min="1"
                value={formFloor}
                onChange={(e) => setFormFloor(e.target.value)}
                placeholder="1, 2, 3..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              {editingTable && !editingTable.status.includes('occupied') && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setManageModalOpen(false);
                    handleDeleteTable(editingTable);
                  }}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => setManageModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingTable}>
                  {savingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Unir Mesas */}
      <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" /> Unir Mesa #{primaryTableForMerge?.number}
          </DialogTitle>
          <DialogDescription>
            Selecciona la mesa que se unirá a la Mesa #{primaryTableForMerge?.number}. Ambas compartirán la misma cuenta, sesión y pedidos.
          </DialogDescription>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Mesa a incorporar:</label>
              <select
                value={selectedSecondaryId}
                onChange={(e) => setSelectedSecondaryId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {tables
                  .filter((t) => t.id !== primaryTableForMerge?.id && !t.mergedWithTableId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Mesa #{t.number} (Piso {t.floor || 1}) - {t.status === 'occupied' ? 'Con comensales' : 'Libre'}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMergeModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmMerge} disabled={merging || !selectedSecondaryId} className="gap-1.5">
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                Unir Mesas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestPill({
  tone,
  icon,
  children,
  onResolve,
}: {
  tone: 'amber' | 'violet';
  icon: React.ReactNode;
  children: React.ReactNode;
  onResolve: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs font-semibold',
        tone === 'amber' ? 'bg-amber-500 text-black' : 'bg-violet-500 text-white',
      )}
    >
      <span className="flex min-w-0 items-center gap-1 truncate">
        {icon} {children}
      </span>
      <button onClick={onResolve} className="rounded bg-black/20 p-0.5 hover:bg-black/40" aria-label="Marcar como atendida" title="Atendida">
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} /> {label}
    </span>
  );
}
