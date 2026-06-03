import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Torneo } from '@/lib/types';
import { actualizarTorneo } from '../../actions';
import { TorneoForm } from '../../TorneoForm';

export default async function EditarTorneoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: torneo }, { data: cats }] = await Promise.all([
    supabase.from('torneos').select('*').eq('id', id).maybeSingle(),
    supabase.from('categorias').select('id, nombre').order('nombre'),
  ]);
  if (!torneo) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/torneos/${id}`} className="text-sm text-tenue hover:underline">
          ← Torneo
        </Link>
        <h1 className="text-2xl font-bold">Editar torneo</h1>
      </div>
      <TorneoForm
        action={actualizarTorneo}
        categorias={(cats as { id: string; nombre: string }[]) ?? []}
        inicial={torneo as Torneo}
      />
    </div>
  );
}
