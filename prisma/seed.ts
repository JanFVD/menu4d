import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=70`;

const menu: Record<string, { name: string; description: string; price: number; image?: string }[]> = {
  Entradas: [
    { name: 'Causa Limeña de Pollo', description: 'Papa amarilla prensada con ají amarillo, palta y pechuga deshilachada.', price: 2200, image: img('photo-1546069901-ba9599a7e63c') },
    { name: 'Tequeños con Guacamole (x6)', description: 'Rellenos de queso andino con salsa de palta fresca.', price: 1800, image: img('photo-1555939594-58d7cb561ad1') },
    { name: 'Anticuchos de Corazón (x2)', description: 'Trozos macerados en ají panca, acompañados de papa dorada y choclo.', price: 2600, image: img('photo-1504674900247-0877df9cc836') },
  ],
  'Platos de Fondo': [
    { name: 'Lomo Saltado Criollo', description: 'Lomo fino al wok con cebolla, tomate, ají amarillo, papas fritas y arroz.', price: 3800, image: img('photo-1600891964092-4316c288032e') },
    { name: 'Ceviche Clásico de Pescado', description: 'Pesca del día en leche de tigre al ají limo, con camote glaseado y choclo.', price: 3600, image: img('photo-1534422298391-e4f8c172dddb') },
    { name: 'Ají de Gallina', description: 'Crema tradicional de ají amarillo con pechuga deshilachada, huevo y aceituna botija.', price: 3200, image: img('photo-1568901346375-23c9450c58cd') },
    { name: 'Arroz con Mariscos', description: 'Arroz norteño especiado con mixtura de mariscos y zarza criolla.', price: 3900, image: img('photo-1565299624946-b28f40a0ae38') },
  ],
  Hamburguesas: [
    { name: 'Hamburguesa Menu4D', description: 'Doble carne artesanal, queso cheddar, tocino crocante, salsa golf y papas nativas.', price: 2800, image: img('photo-1568901346375-23c9450c58cd') },
    { name: 'Hamburguesa Parrillera', description: 'Carne a la parrilla, chorizo parrillero, chimichurri y cebolla caramelizada.', price: 3000, image: img('photo-1513104890138-7c749659a591') },
  ],
  Postres: [
    { name: 'Suspiro a la Limeña', description: 'Manjar blanco de yemas coronado con merengue al oporto y canela.', price: 1500, image: img('photo-1563805042-7684c019e1cb') },
    { name: 'Tres Leches Tradicional', description: 'Bizcocho bañado en tres leches con canela molida.', price: 1600, image: img('photo-1488477181946-6428a0291777') },
    { name: 'Helado Artesanal (2 bolas)', description: 'Sabores: Lúcuma, Maracuyá, Chocolate cusqueño.', price: 1400, image: img('photo-1563805042-7684c019e1cb') },
  ],
  Bebidas: [
    { name: 'Chicha Morada Jarra 1L', description: 'Elaborada artesanalmente con maíz morado, piña, membrillo, clavo y canela.', price: 1400, image: img('photo-1554866585-cd94860890b7') },
    { name: 'Inca Kola 500 ml', description: 'Original o Zero.', price: 600, image: img('photo-1554866585-cd94860890b7') },
    { name: 'Cerveza Cusqueña 330 ml', description: 'Dorada, Trigo o Negra.', price: 900, image: img('photo-1510812431401-41d2bd2722f3') },
    { name: 'Pisco Sour Clásico', description: 'Pisco Quebranta acholado, jugo de limón, jarabe de goma y amargo de angostura.', price: 2200, image: img('photo-1544145945-f90425340c7e') },
  ],
};

const staffUsers = [
  { username: 'admin', password: 'admin123', name: 'Administrador General', roles: ['admin', 'cocina', 'caja', 'mozo'] },
  { username: 'cocina', password: 'cocina123', name: 'Jefe de Cocina', roles: ['cocina'] },
  { username: 'caja', password: 'caja123', name: 'Cajero Principal', roles: ['caja'] },
  { username: 'mozo', password: 'mozo123', name: 'Mozo de Salón', roles: ['mozo'] },
];

async function main() {
  // Limpieza en orden de dependencias
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();
  await prisma.businessSetting.deleteMany();

  // Mesas (Piso 1 y Piso 2)
  for (let n = 1; n <= 12; n++) {
    await prisma.table.create({ data: { number: n, floor: n <= 8 ? 1 : 2 } });
  }

  // Menú
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

  // Staff inicial
  for (const u of staffUsers) {
    await prisma.user.create({
      data: u,
    });
  }

  // Configuración de la empresa
  await prisma.businessSetting.create({
    data: {
      id: 'default',
      name: 'RESTAURANTE EL SABOR PERUANO S.A.C.',
      ruc: '20601234567',
      address: 'Av. José Larco 850, Miraflores, Lima',
      phone: '(01) 445-9876 / 998 123 456',
      logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=240&h=240&q=80',
      ticketFooter: '¡Gracias por su visita!\nComprobante emitido electrónicamente.\nConserve su ticket para cualquier reclamo.',
    },
  });

  console.log('Seed exitoso!');
  console.log('Usuarios de staff creados:');
  for (const u of staffUsers) {
    console.log(`- ${u.username} (password: ${u.password}) -> roles: ${u.roles.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
