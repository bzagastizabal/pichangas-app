'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cerrarSesion } from '@/lib/auth-actions';

const grupos = [
  {
    titulo: 'Operación',
    items: [
      { href: '/admin/eventos', label: 'Eventos', icon: '🏀' },
      { href: '/admin/jugadores', label: 'Jugadores', icon: '👥' },
      { href: '/admin/pagos', label: 'Pagos', icon: '💳' },
      { href: '/admin/publicaciones', label: 'Publicaciones', icon: '📰' },
    ],
  },
  {
    titulo: 'Finanzas',
    items: [{ href: '/admin/finanzas', label: 'Finanzas', icon: '📊' }],
  },
  {
    titulo: 'Configuración',
    items: [
      { href: '/admin/sedes', label: 'Sedes', icon: '📍' },
      { href: '/admin/arbitros', label: 'Árbitros', icon: '🧑‍⚖️' },
      { href: '/admin/categorias', label: 'Categorías', icon: '🏷️' },
      { href: '/admin/staff', label: 'Staff', icon: '🧑‍💼' },
    ],
  },
];

export function AdminShell({
  nombre,
  children,
}: {
  nombre: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const Nav = (
    <nav className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 mb-1 text-xs uppercase tracking-wide text-tenue">{g.titulo}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  onClick={() => setAbierto(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    activo(it.href)
                      ? 'bg-orange-600 text-white'
                      : 'text-texto hover:bg-white/5'
                  }`}
                >
                  <span aria-hidden>{it.icon}</span>
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-borde bg-tarjeta">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            className="lg:hidden text-texto text-xl leading-none"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/cmt_letras.png"
              alt="CMT"
              width={1000}
              height={244}
              className="h-7 w-auto"
              priority
            />
            <span className="text-sm font-semibold text-tenue">Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm text-tenue">
            <span className="hidden sm:inline">{nombre}</span>
            <Link href="/dashboard" className="hover:text-orange-600">
              Inicio
            </Link>
            <form action={cerrarSesion}>
              <button type="submit" className="hover:text-orange-600">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-56 shrink-0 border-r border-borde p-4 min-h-[calc(100vh-3.5rem)]">
          {Nav}
        </aside>

        {abierto && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setAbierto(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto border-r border-borde bg-tarjeta p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">Menú</span>
                <button onClick={() => setAbierto(false)} aria-label="Cerrar menú">
                  ✕
                </button>
              </div>
              {Nav}
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 py-8">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
