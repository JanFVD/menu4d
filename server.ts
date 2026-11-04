/**
 * Servidor custom: Next.js (App Router) + Socket.io sobre el mismo puerto HTTP.
 *   dev:   npm run dev
 *   prod:  npm run build && npm start
 */
import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { registerSocketHandlers } from '@/lib/server/socket';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@/lib/types';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;
const hostname = '0.0.0.0'; // accesible desde celulares en la LAN

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    // Recupera eventos perdidos en microcortes de Wi-Fi (mismo socket.id y rooms).
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  registerSocketHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Menu4D listo en http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
  });
});

