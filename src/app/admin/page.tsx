// src/app/admin/page.tsx
// Inicio del panel de administración: accesos a los CRUD de Fase 1.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function AdminHomePage() {
  const supabase = await createClient();

  // Conteos rápidos (head:true -> no trae filas, solo el count).
  const [
    { count: totalEventos },
    { count: pagosPorRevisar },
    { count: totalSedes },
    { count: totalArbitros },
  ] = await Promise.all([
    supabase.from('eventos').select('*', { count: 'exact', head: true }),
    supabase
      .from('pagos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'en_revision'),
    supabase.from('sedes').select('*', { count: 'exact', head: true }),
    supabase.from('arbitros').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panel de administración</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/eventos"
          className="block rounded-lg border border-gray-200 p-6 hover:border-orange-500 hover:shadow-sm transition"
        >
          <h2 className="text-lg font-semibold">Eventos 🏀</h2>
          <p className="text-sm text-gray-500">Pichangas: fechas, cupos y costos.</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{totalEventos ?? 0}</p>
        </Link>
        <Link
          href="/admin/pagos"
          className="block rounded-lg border border-gray-200 p-6 hover:border-orange-500 hover:shadow-sm transition"
        >
          <h2 className="text-lg font-semibold">Pagos 💳</h2>
          <p className="text-sm text-gray-500">Comprobantes por revisar.</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{pagosPorRevisar ?? 0}</p>
        </Link>
        <Link
          href="/admin/sedes"
          className="block rounded-lg border border-gray-200 p-6 hover:border-orange-500 hover:shadow-sm transition"
        >
          <h2 className="text-lg font-semibold">Sedes 📍</h2>
          <p className="text-sm text-gray-500">Canchas donde se juegan las pichangas.</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{totalSedes ?? 0}</p>
        </Link>
        <Link
          href="/admin/arbitros"
          className="block rounded-lg border border-gray-200 p-6 hover:border-orange-500 hover:shadow-sm transition"
        >
          <h2 className="text-lg font-semibold">Árbitros 🧑‍⚖️</h2>
          <p className="text-sm text-gray-500">Árbitros disponibles y sus tarifas.</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{totalArbitros ?? 0}</p>
        </Link>
      </div>
    </div>
  );
}
