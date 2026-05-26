// src/app/admin/eventos/[id]/editar/page.tsx
// Editar evento. Aquí ofrecemos TODAS las sedes/árbitros (no solo activos) para
// que la selección actual del evento siga apareciendo aunque se haya desactivado.
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Evento } from '@/lib/types';
import { eventoYaTermino } from '@/lib/fechas';
import { EventoForm } from '../../EventoForm';
import { actualizarEvento } from '../../actions';

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: evento },
    { data: sedes },
    { data: arbitros },
    { data: categorias },
    { data: relArbitros },
  ] = await Promise.all([
    supabase.from('eventos').select('*').eq('id', id).single(),
    supabase.from('sedes').select('id, nombre, precio_por_hora').order('nombre'),
    supabase
      .from('arbitros')
      .select('id, nombre, precio_por_hora, tarifa_1h, tarifa_2h')
      .order('nombre'),
    supabase.from('categorias').select('id, nombre').order('nombre'),
    supabase.from('evento_arbitros').select('arbitro_id').eq('evento_id', id),
  ]);

  if (!evento) notFound();

  const ev = evento as Evento;
  // Un evento ya realizado es histórico: no se edita. Ofrecemos copiarlo.
  if (eventoYaTermino(ev.fecha_hora_evento, ev.duracion_horas)) {
    redirect(
      '/admin/eventos?error=' +
        encodeURIComponent(
          'Ese evento ya se realizó; no se puede editar. Usa "Copiar" para crear uno nuevo.',
        ),
    );
  }

  const arbitrosSeleccionados = (relArbitros ?? []).map((r) => r.arbitro_id as string);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar evento</h1>
      <EventoForm
        action={actualizarEvento}
        sedes={sedes ?? []}
        arbitros={arbitros ?? []}
        arbitrosSeleccionados={arbitrosSeleccionados}
        categorias={categorias ?? []}
        inicial={ev}
      />
    </div>
  );
}
