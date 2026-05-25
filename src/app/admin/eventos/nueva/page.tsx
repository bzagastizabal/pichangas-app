// src/app/admin/eventos/nueva/page.tsx
// Crear evento. Solo se ofrecen sedes y árbitros ACTIVOS.
// Con ?desde=<id> copia la configuración de un evento existente (sin sus
// participantes ni fechas) para ahorrar tiempo al armar uno parecido.
import { createClient } from '@/lib/supabase/server';
import type { Evento } from '@/lib/types';
import { EventoForm } from '../EventoForm';
import { crearEvento } from '../actions';

export default async function NuevoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const { desde } = await searchParams;
  const supabase = await createClient();
  const [{ data: sedes }, { data: arbitros }, { data: categorias }] = await Promise.all([
    supabase
      .from('sedes')
      .select('id, nombre, precio_por_hora')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('arbitros')
      .select('id, nombre, precio_por_hora, tarifa_1h, tarifa_2h, tarifa_3h, tarifa_mas')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
  ]);

  // Si venimos de "Copiar", traemos el evento origen y sus árbitros.
  let base: Evento | undefined;
  let arbitrosSeleccionados: string[] = [];
  if (desde) {
    const [{ data: ev }, { data: rel }] = await Promise.all([
      supabase.from('eventos').select('*').eq('id', desde).single(),
      supabase.from('evento_arbitros').select('arbitro_id').eq('evento_id', desde),
    ]);
    base = (ev as Evento | null) ?? undefined;
    arbitrosSeleccionados = (rel ?? []).map((r) => r.arbitro_id as string);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{base ? 'Copiar evento' : 'Nuevo evento'}</h1>
      {base && (
        <p className="rounded border border-borde bg-tarjeta p-3 text-sm text-tenue">
          Copiaste la configuración de un evento. Elige las nuevas fechas y guarda;
          se crea un evento nuevo sin participantes.
        </p>
      )}
      <EventoForm
        action={crearEvento}
        sedes={sedes ?? []}
        arbitros={arbitros ?? []}
        arbitrosSeleccionados={arbitrosSeleccionados}
        categorias={categorias ?? []}
        inicial={base}
        esCopia={!!base}
      />
    </div>
  );
}
