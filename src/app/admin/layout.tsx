// src/app/admin/layout.tsx
// Layout del panel de administración. Protege TODO /admin: solo administradores.
// Las Server Actions verifican el rol por su cuenta (defensa en profundidad),
// pero este guard evita que un participante siquiera vea las pantallas.
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireAdmin();

  return (
    <div className="min-h-full">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/admin" className="font-bold text-orange-600">
            🏀 Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/eventos" className="hover:text-orange-600">
              Eventos
            </Link>
            <Link href="/admin/pagos" className="hover:text-orange-600">
              Pagos
            </Link>
            <Link href="/admin/sedes" className="hover:text-orange-600">
              Sedes
            </Link>
            <Link href="/admin/arbitros" className="hover:text-orange-600">
              Árbitros
            </Link>
          </nav>
          <span className="ml-auto text-sm text-gray-500">
            {perfil.nombre_completo}
          </span>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-orange-600">
            Salir del panel
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
