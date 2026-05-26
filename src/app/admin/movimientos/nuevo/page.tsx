// src/app/admin/movimientos/nuevo/page.tsx
// Alta de un movimiento (ingreso o egreso). Quien registra es siempre admin
// y queda como `creado_por`; la aprobación se hace luego desde la lista.
// Con ?evento=<id> se preselecciona el evento (atajo desde el detalle del evento).
import { createClient } from '@/lib/supabase/server';
import { formatearFechaLima } from '@/lib/fechas';
import { MovimientoForm } from '../MovimientoForm';
import { crearMovimiento } from '../actions';

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento } = await searchParams;
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from('eventos')
    .select('id, fecha_hora_evento, sedes(nombre)')
    .order('fecha_hora_evento', { ascending: false })
    .limit(50);

  const eventos = ((ev as unknown as
    | { id: string; fecha_hora_evento: string; sedes: { nombre: string } | null }[]
    | null) ?? []
  ).map((e) => ({
    id: e.id,
    nombre: `${e.sedes?.nombre ?? 'Evento'} · ${formatearFechaLima(e.fecha_hora_evento)}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo movimiento</h1>
      <p className="text-sm text-tenue">
        Registra un ingreso o egreso. Puede ser independiente o quedar vinculado a un
        evento (donación para la pichanga, gasto extra, etc.). Queda en estado{' '}
        <strong>pendiente</strong> hasta que un admin lo apruebe; solo los aprobados
        cuentan en el balance.
      </p>
      <MovimientoForm
        action={crearMovimiento}
        eventos={eventos}
        eventoInicial={evento ?? ''}
      />
    </div>
  );
}
