import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Torneo } from '@/lib/types';
import { crearPartido } from '../actions';
import { PartidoForm } from '../PartidoForm';

export default async function NuevoPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('torneos').select('id, nombre').eq('id', id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/torneos/${id}`} className="text-sm text-tenue hover:underline">
          ← {(data as Pick<Torneo, 'nombre'>).nombre}
        </Link>
        <h1 className="text-2xl font-bold">Nuevo partido</h1>
      </div>
      <PartidoForm action={crearPartido} torneoId={id} />
    </div>
  );
}
