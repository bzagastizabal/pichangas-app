// src/app/admin/arbitros/[id]/editar/page.tsx
// Pantalla para editar un árbitro existente.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Arbitro } from '@/lib/types';
import { ArbitroForm } from '../../ArbitroForm';
import { actualizarArbitro } from '../../actions';

export default async function EditarArbitroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('arbitros')
    .select('*')
    .eq('id', id)
    .single();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar árbitro</h1>
      <ArbitroForm action={actualizarArbitro} inicial={data as Arbitro} />
    </div>
  );
}
