// src/app/admin/eventos/[id]/editar/page.tsx
// Editar evento. Aquí ofrecemos TODAS las sedes/árbitros (no solo activos) para
// que la selección actual del evento siga apareciendo aunque se haya desactivado.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Evento } from '@/lib/types';
import { EventoForm } from '../../EventoForm';
import { actualizarEvento } from '../../actions';

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: evento }, { data: sedes }, { data: arbitros }, { data: categorias }] =
    await Promise.all([
      supabase.from('eventos').select('*').eq('id', id).single(),
      supabase.from('sedes').select('id, nombre, precio_por_hora').order('nombre'),
      supabase.from('arbitros').select('id, nombre, precio_por_hora').order('nombre'),
      supabase.from('categorias').select('id, nombre').order('nombre'),
    ]);

  if (!evento) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar evento</h1>
      <EventoForm
        action={actualizarEvento}
        sedes={sedes ?? []}
        arbitros={arbitros ?? []}
        categorias={categorias ?? []}
        inicial={evento as Evento}
      />
    </div>
  );
}
