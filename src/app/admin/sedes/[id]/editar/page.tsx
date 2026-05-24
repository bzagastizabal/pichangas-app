// src/app/admin/sedes/[id]/editar/page.tsx
// Pantalla para editar una sede existente.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Sede } from '@/lib/types';
import { SedeForm } from '../../SedeForm';
import { actualizarSede } from '../../actions';

export default async function EditarSedePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('sedes').select('*').eq('id', id).single();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar sede</h1>
      <SedeForm action={actualizarSede} inicial={data as Sede} />
    </div>
  );
}
