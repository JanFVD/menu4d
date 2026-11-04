import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Menu4D — Carta digital y gestión en tiempo real',
  description: 'Pedí desde tu mesa escaneando el QR.',
  appleWebApp: { capable: true, title: 'Menu4D', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

