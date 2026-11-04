'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Edit,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Plus,
  Power,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatMoney } from '@/lib/utils';
import type { CategoryDTO, ProductDTO } from '@/lib/types';

interface FullCategory extends CategoryDTO {
  products: (ProductDTO & { available?: boolean })[];
}

export function MenuTab() {
  const [categories, setCategories] = useState<FullCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<CategoryDTO | null>(null);
  const [catNameInput, setCatNameInput] = useState('');

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodEditing, setProdEditing] = useState<ProductDTO | null>(null);

  // Form states producto
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(''); // en Soles (ej. 25.50)
  const [prodCatId, setProdCatId] = useState('');
  const [prodImg, setProdImg] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (data.ok) {
        setCategories(data.categories);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error al cargar la carta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // ------------------------------------------------ Categorías
  const handleOpenCategoryModal = (cat?: CategoryDTO) => {
    if (cat) {
      setCatEditing(cat);
      setCatNameInput(cat.name);
    } else {
      setCatEditing(null);
      setCatNameInput('');
    }
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) return;
    try {
      setSaving(true);
      const isEdit = Boolean(catEditing);
      const res = await fetch('/api/menu', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          id: catEditing?.id,
          name: catNameInput.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setCatModalOpen(false);
      await fetchMenu();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryDTO) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    try {
      const res = await fetch(`/api/menu?type=category&id=${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (selectedCat === cat.id) setSelectedCat('all');
      await fetchMenu();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // ------------------------------------------------ Productos
  const handleOpenProductModal = (prod?: ProductDTO) => {
    if (prod) {
      setProdEditing(prod);
      setProdName(prod.name);
      setProdDesc(prod.description);
      setProdPrice((prod.price / 100).toFixed(2));
      const parentCat = categories.find((c) => c.products.some((p) => p.id === prod.id));
      setProdCatId(parentCat?.id ?? categories[0]?.id ?? '');
      setProdImg(prod.imageUrl || '');
      setProdAvailable(prod.available ?? true);
    } else {
      setProdEditing(null);
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdCatId(selectedCat !== 'all' ? selectedCat : (categories[0]?.id ?? ''));
      setProdImg('');
      setProdAvailable(true);
    }
    setProdModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(prodPrice);
    if (!prodName.trim() || isNaN(priceNum) || !prodCatId) {
      alert('Completa el nombre, categoría y precio');
      return;
    }

    try {
      setSaving(true);
      const isEdit = Boolean(prodEditing);
      const priceInCents = Math.round(priceNum * 100);

      const res = await fetch('/api/menu', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'product',
          id: prodEditing?.id,
          name: prodName.trim(),
          description: prodDesc.trim(),
          price: priceInCents,
          categoryId: prodCatId,
          imageUrl: prodImg.trim() || null,
          available: prodAvailable,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setProdModalOpen(false);
      await fetchMenu();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (prod: ProductDTO) => {
    try {
      const newStatus = !(prod.available ?? true);
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'product',
          id: prod.id,
          available: newStatus,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.map((p) => (p.id === prod.id ? { ...p, available: newStatus } : p)),
        })),
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteProduct = async (prod: ProductDTO) => {
    if (!confirm(`¿Eliminar el producto "${prod.name}" del menú?`)) return;
    try {
      const res = await fetch(`/api/menu?type=product&id=${prod.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchMenu();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const visibleProducts = categories
    .filter((c) => (selectedCat === 'all' ? true : c.id === selectedCat))
    .flatMap((c) => c.products.map((p) => ({ ...p, categoryName: c.name })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <UtensilsCrossed className="h-6 w-6 text-primary" /> Administración del Menú
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea o modifica platos, precios en soles (S/), fotos, categorías y disponibilidad en tiempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleOpenCategoryModal()} className="gap-1.5">
            <FolderPlus className="h-4 w-4" /> Nueva Categoría
          </Button>
          <Button onClick={() => handleOpenProductModal()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo Producto
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Filtro y gestión de categorías */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <Button
          size="sm"
          variant={selectedCat === 'all' ? 'default' : 'secondary'}
          onClick={() => setSelectedCat('all')}
        >
          Todas las categorías ({categories.reduce((acc, c) => acc + c.products.length, 0)})
        </Button>
        {categories.map((c) => (
          <div key={c.id} className="flex items-center rounded-lg bg-secondary/60 p-0.5">
            <button
              onClick={() => setSelectedCat(c.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCat === c.id ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground hover:bg-muted'
              }`}
            >
              {c.name} ({c.products.length})
            </button>
            <button
              onClick={() => handleOpenCategoryModal(c)}
              title="Editar nombre"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-3 w-3" />
            </button>
            {c.products.length === 0 && (
              <button
                onClick={() => handleDeleteCategory(c)}
                title="Eliminar categoría vacía"
                className="p-1 text-destructive/80 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lista de productos */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((p) => {
            const isAvail = p.available ?? true;
            return (
              <Card key={p.id} className={`flex flex-col overflow-hidden ${!isAvail ? 'opacity-60 bg-muted/20' : ''}`}>
                <div className="relative h-36 w-full bg-muted">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-background/85 px-2 py-0.5 text-[10px] font-semibold uppercase backdrop-blur-sm">
                    {p.categoryName}
                  </span>
                  <button
                    onClick={() => handleToggleAvailability(p)}
                    className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm transition-colors ${
                      isAvail ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {isAvail ? 'Disponible' : 'Agotado'}
                  </button>
                </div>

                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-tight">{p.name}</h3>
                    <span className="shrink-0 text-base font-black text-primary">
                      {formatMoney(p.price)}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleAvailability(p)}
                      className="h-8 gap-1 text-xs"
                    >
                      <Power className={`h-3.5 w-3.5 ${isAvail ? 'text-emerald-400' : 'text-red-400'}`} />
                      {isAvail ? 'Pausar' : 'Activar'}
                    </Button>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleOpenProductModal(p)} className="h-8 w-8 p-0">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteProduct(p)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Categoría */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{catEditing ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          <DialogDescription>
            {catEditing ? 'Modifica el nombre de la sección.' : 'Crea una nueva sección para agrupar productos.'}
          </DialogDescription>
          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nombre de Categoría</label>
              <input
                required
                autoFocus
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
                placeholder="Ej: Tragos, Pizzas, Guarniciones"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCatModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Producto */}
      <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{prodEditing ? 'Modificar Plato / Producto' : 'Nuevo Plato / Producto'}</DialogTitle>
          <DialogDescription>
            Los cambios se verán reflejados al instante en la carta digital de los clientes.
          </DialogDescription>
          <form onSubmit={handleSaveProduct} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nombre del Plato / Bebida</label>
              <input
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Ej: Lomo Saltado Criollo"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Categoría</label>
                <select
                  required
                  value={prodCatId}
                  onChange={(e) => setProdCatId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Precio en Soles (S/)</label>
                <input
                  required
                  type="number"
                  step="0.10"
                  min="0"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="Ej: 35.00"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Descripción / Ingredientes</label>
              <textarea
                rows={2}
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Descripción detallada para el comensal..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">URL de Imagen (Unsplash o enlace directo)</label>
              <input
                type="url"
                value={prodImg}
                onChange={(e) => setProdImg(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="availProd"
                checked={prodAvailable}
                onChange={(e) => setProdAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="availProd" className="text-xs font-medium">
                Disponible para pedir en la carta
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setProdModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Producto
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

