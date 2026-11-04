import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=70`;

const menu: Record<string, { name: string; description: string; price: number; image?: string }[]> = {
  Entradas: [
    { name: 'Empanadas criollas (x3)', description: 'Carne cortada a cuchillo, cebolla de verdeo y huevo.', price: 690000, image: img('photo-1555939594-58d7cb561ad1') },
    { name: 'Provoleta a la parrilla', description: 'Con orégano, ají molido y oliva.', price: 820000, image: img('photo-1504674900247-0877df9cc836') },
    { name: 'Ensalada César', description: 'Lechuga romana, croutons, parmesano y aderezo César.', price: 950000, image: img('photo-1546069901-ba9599a7e63c') },
  ],
  Principales: [
    { name: 'Bife de chorizo', description: '400 g a la parrilla con papas rústicas.', price: 2290000, image: img('photo-1600891964092-4316c288032e') },
    { name: 'Hamburguesa Menu4D', description: 'Doble medallón, cheddar, panceta y papas fritas.', price: 1490000, image: img('photo-1568901346375-23c9450c58cd') },
    { name: 'Sorrentinos de jamón y queso', description: 'Con salsa fileto o crema.', price: 1350000, image: img('photo-1621996346565-e3dbc646d9a9') },
    { name: 'Spaghetti al pesto', description: 'Albahaca fresca, nueces y parmesano.', price: 1190000, image: img('photo-1473093295043-cdd812d0e601') },
  ],
  Pizzas: [
    { name: 'Muzzarella', description: 'Salsa de tomate, muzzarella y aceitunas.', price: 1100000, image: img('photo-1513104890138-7c749659a591') },
    { name: 'Napolitana', description: 'Tomate en rodajas, ajo y albahaca.', price: 1250000, image: img('photo-1565299624946-b28f40a0ae38') },
  ],
  Postres: [
    { name: 'Helado artesanal', description: 'Dos bochas a elección.', price: 520000, image: img('photo-1563805042-7684c019e1cb') },
    { name: 'Copa de frutos rojos', description: 'Yogur, granola y frutos rojos.', price: 610000, image: img('photo-1488477181946-6428a0291777') },
  ],
  Bebidas: [
    { name: 'Gaseosa 500 ml', description: 'Línea Coca-Cola.', price: 280000, image: img('photo-1554866585-cd94860890b7') },
    { name: 'Copa de Malbec', description: 'Mendoza, 150 ml.', price: 450000, image: img('photo-1510812431401-41d2bd2722f3') },
    { name: 'Trago de autor', description: 'Consultá la propuesta del día.', price: 680000, image: img('photo-1544145945-f90425340c7e') },
  ],
};

async function main() {
  // Limpieza en orden de dependencias
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();

  for (let n = 1; n <= 12; n++) {
    await prisma.table.create({ data: { number: n } });
  }

  let catOrder = 0;
  for (const [categoryName, products] of Object.entries(menu)) {
    await prisma.category.create({
      data: {
        name: categoryName,
        sortOrder: catOrder++,
        products: {
          create: products.map((p, i) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            imageUrl: p.image ?? null,
            sortOrder: i,
          })),
        },
      },
    });
  }

  const tables = await prisma.table.findMany({ orderBy: { number: 'asc' }, take: 3 });
  console.log('Seed OK. URLs de ejemplo:');
  for (const t of tables) console.log(`  Mesa ${t.number}: http://localhost:3000/mesa/${t.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

