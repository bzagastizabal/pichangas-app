// src/app/admin/movimientos/nuevo/page.tsx
// Alta de un movimiento (ingreso o egreso). Queda creado_por = admin actual.
// Acepta query params para pre-seleccionar:
//   ?evento=<id>           desde el detalle de un evento
//   ?torneo=<id>           desde el detalle del torneo
//   ?partido=<pid>&torneo=<tid>  desde el detalle del partido
import { createClient } from '@/lib/supabase/server';
import { formatearFechaLima } from '@/lib/fechas';
import { MovimientoForm } from '../MovimientoForm';
import { crearMovimiento } from '../actions';

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string; torneo?: string; partido?: string }>;
}) {
  const { evento, torneo, partido } = await searchParams;
  const supabase = await createClient();

  const [{ data: ev }, { data: tr }, { data: pa }] = await Promise.all([
    supabase
      .from('eventos')
      .select('id, fecha_hora_evento, sedes(nombre)')
      .order('fecha_hora_evento', { ascending: false })
      .limit(50),
    supabase
      .from('torneos')
      .select('id, nombre, fecha_inicio')
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .limit(50),
    // Solo trae partidos cuando hay torneo preseleccionado (para acotar).
    torneo
      ? supabase
          .from('torneo_partidos')
          .select('id, rival, fecha')
          .eq('torneo_id', torneo)
          .order('fecha', { ascending: true })
      : Promise.resolve({ data: null as null }),
  ]);

  const eventos = ((ev as unknown as
    | { id: string; fecha_hora_evento: string; sedes: { nombre: string } | null }[]
    | null) ?? []
  ).map((e) => ({
    id: e.id,
    nombre: `${e.sedes?.nombre ?? 'Evento'} · ${formatearFechaLima(e.fecha_hora_evento)}`,
  }));

  const torneos = ((tr as { id: string; nombre: string; fecha_inicio: string | null }[] | null) ?? []).map(
    (t) => ({
      id: t.id,
      nombre: t.fecha_inicio ? `${t.nombre} · ${t.fecha_inicio}` : t.nombre,
    }),
  );

  const partidos = ((pa as { id: string; rival: string; fecha: string }[] | null) ?? []).map(
    (p) => ({ id: p.id, nombre: `vs ${p.rival} · ${formatearFechaLima(p.fecha)}` }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo movimiento</h1>
      <p className="text-sm text-tenue">
        Registra un ingreso o egreso. Puede ser independiente o quedar vinculado a un
        evento, torneo o partido. Queda en estado <strong>pendiente</strong> hasta que
        un admin lo apruebe; solo los aprobados cuentan en el balance.
      </p>
      <MovimientoForm
        action={crearMovimiento}
        eventos={eventos}
        torneos={torneos}
        partidos={partidos}
        eventoInicial={evento ?? ''}
        torneoInicial={torneo ?? ''}
        partidoInicial={partido ?? ''}
      />
    </div>
  );
}
