'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, ShieldAlert, Trash2, UserCheck, UserCog, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { STAFF_ROLES, type StaffRole, type StaffUserDTO } from '@/lib/types';
import { useDashboard } from './DashboardProvider';

const ROLE_COLORS: Record<StaffRole, 'violet' | 'warning' | 'success' | 'info'> = {
  admin: 'violet',
  cocina: 'warning',
  caja: 'success',
  mozo: 'info',
};

export function StaffTab() {
  const { staffUser } = useDashboard();
  const [users, setUsers] = useState<StaffUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<StaffUserDTO | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoles, setFormRoles] = useState<StaffRole[]>(['mozo']);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff');
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error al cargar la lista de personal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRoles(['mozo']);
    setFormActive(true);
    setError(null);
    setCreateOpen(true);
  };

  const openEditModal = (u: StaffUserDTO) => {
    setEditUser(u);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRoles([...u.roles]);
    setFormActive(u.active);
    setError(null);
  };

  const toggleRole = (role: StaffRole) => {
    setFormRoles((prev) =>
      prev.includes(role) ? (prev.length > 1 ? prev.filter((r) => r !== role) : prev) : [...prev, role],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formPassword || !formName) {
      setError('Por favor complete todos los campos');
      return;
    }
    if (formRoles.length === 0) {
      setError('Debe asignar al menos un rol');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          name: formName,
          roles: formRoles,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al crear usuario');

      setCreateOpen(false);
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (!formName) {
      setError('El nombre no puede estar vacío');
      return;
    }
    if (formRoles.length === 0) {
      setError('Debe asignar al menos un rol');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editUser.id,
          name: formName,
          roles: formRoles,
          password: formPassword || undefined,
          active: formActive,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al actualizar usuario');

      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: StaffUserDTO) => {
    if (!confirm(`¿Eliminar al usuario ${u.name} (@${u.username})?`)) return;

    try {
      const res = await fetch(`/api/staff?id=${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al eliminar usuario');
      await fetchUsers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Personal y Roles del Staff
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea usuarios, modifica sus roles y asigna múltiples funciones a cada colaborador.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <UserPlus className="h-4 w-4" /> Nuevo Personal
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => {
            const isSelf = staffUser?.id === u.id;
            return (
              <Card key={u.id} className={!u.active ? 'opacity-60' : undefined}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {u.name}
                      {isSelf && <span className="text-xs font-normal text-muted-foreground">(Tú)</span>}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs text-primary">
                      @{u.username}
                    </CardDescription>
                  </div>
                  <Badge variant={u.active ? 'success' : 'secondary'}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">Roles asignados:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={ROLE_COLORS[r]}>
                          {r.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => openEditModal(u)} className="gap-1.5">
                      <UserCog className="h-3.5 w-3.5" /> Modificar
                    </Button>
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(u)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear Usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Nuevo Usuario del Staff
          </DialogTitle>
          <DialogDescription>
            Crea credenciales de acceso y asigna uno o varios roles para las áreas del local.
          </DialogDescription>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nombre Completo</label>
              <input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Carlos Sánchez"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Usuario / Login</label>
              <input
                required
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                placeholder="Ej: carloss"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Contraseña</label>
              <input
                required
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Contraseña segura"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Roles (puede tener varios):</label>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_ROLES.map((r) => {
                  const selected = formRoles.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      <span className="capitalize">{r.label}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Personal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Modificar Roles y Datos */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> Modificar Usuario
          </DialogTitle>
          <DialogDescription>
            Actualiza los datos y asigna o modifica los roles asignados a @{editUser?.username}.
          </DialogDescription>

          <form onSubmit={handleUpdate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nombre Completo</label>
              <input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Cambiar Contraseña (dejar en blanco para mantener)</label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Nueva contraseña opcional"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Roles (puede marcar múltiples roles):</label>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_ROLES.map((r) => {
                  const selected = formRoles.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      <span className="capitalize">{r.label}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="activeCheckbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="activeCheckbox" className="text-xs font-medium">
                Usuario activo (puede iniciar sesión)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
