// src/app/marcador/[slug]/page.tsx
// Pantalla pública del marcador (proyección). Sin sesión: la RLS permite
// SELECT para cualquiera. Si está expirado o no existe, se ve un mensaje.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Marcador } from '@/lib/types';
import { VisorMarcador } from './VisorMarcador';

export default async function MarcadorPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('marcadores')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) notFound();
  const m = data as Marcador;
  const expirado = new Date(m.expira_en).getTime() < Date.now();

  if (expirado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-3">
          <p className="text-6xl">⏱️</p>
          <p className="text-2xl">Este marcador expiró.</p>
          <p className="text-sm text-zinc-400">Pídele al admin uno nuevo.</p>
        </div>
      </div>
    );
  }

  return <VisorMarcador inicial={m} />;
}
