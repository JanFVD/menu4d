'use client';

import { io, type Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from './types';

export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppClientSocket | null = null;

/** Socket singleton por pestaña (mismo origen que Next). */
export function getSocket(): AppClientSocket {
  if (!socket) {
    socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  }
  return socket;
}

/** Envuelve un emit con ack en una Promise que rechaza con el mensaje del servidor. */
export function request<T>(emit: (ack: Ack<T>) => void, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Sin respuesta del servidor')), timeoutMs);
    emit((res) => {
      clearTimeout(timer);
      if (res.ok) resolve(res.data);
      else reject(new Error(res.error));
    });
  });
}

/** Estado de conexión reactivo. */
export function useConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    setConnected(s.connected);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return connected;
}

/** Reloj que se actualiza cada `ms` (para temporizadores). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

