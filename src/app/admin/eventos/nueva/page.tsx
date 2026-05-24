// src/app/admin/eventos/nueva/page.tsx
// Crear evento. Solo se ofrecen sedes y árbitros ACTIVOS.
import { createClient } from '@/lib/supabase/server';
import { EventoForm } from '../EventoForm';
import { crearEvento } from '../actions';

export default async function NuevoEventoPage() {
  const supabase = await createClient();
  const [{ data: sedes }, { data: arbitros }] = await Promise.all([
    supabase
      .from('sedes')
      .select('id, nombre, precio_por_hora')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('arbitros')
      .select('id, nombre, precio_por_hora')
      .eq('activo', true)
      .order('nombre'),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo evento</h1>
      <EventoForm
        action={crearEvento}
        sedes={sedes ?? []}
        arbitros={arbitros ?? []}
      />
    </div>
  );
}
