// src/app/marcador/[slug]/page.tsx
// Pantalla pública del marcador (proyección). Sin sesión: la RLS permite
// SELECT para cualquiera. Si está expirado o no existe, se ve un mensaje.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSesion } from '@/lib/auth';
import type { Marcador } from '@/lib/types';
import { VisorMarcador } from './VisorMarcador';

// Metadata por marcador: WhatsApp ve nombres + puntaje en el preview, no la
// card genérica del club. La imagen viene de opengraph-image.tsx (dinámica).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('marcadores')
    .select('nombre_local, nombre_visitante, puntos_local, puntos_visitante, periodo')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) {
    return {
      title: 'Marcador — CMT BasketBall Club',
      description: 'Marcador en vivo del CMT BasketBall Club.',
    };
  }
  const periodo = data.periodo <= 4 ? `Q${data.periodo}` : `OT${data.periodo - 4}`;
  const titulo = `🏀 ${data.nombre_local} ${data.puntos_local} – ${data.puntos_visitante} ${data.nombre_visitante}`;
  const descripcion = `Marcador en vivo · Periodo ${periodo} · CMT BasketBall Club.`;
  return {
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion, type: 'website' },
    twitter: { title: titulo, description: descripcion, card: 'summary_large_image' },
  };
}

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

  // Si quien abre el link es admin, el visor muestra el dock de control en la
  // misma pantalla (operar desde el móvil sin abrir el panel aparte). La RLS
  // sigue siendo la barrera real: las Server Actions revalidan con requireAdmin.
  const { perfil } = await getSesion();
  const puedeControlar = perfil?.rol === 'administrador';

  return <VisorMarcador inicial={m} puedeControlar={puedeControlar} />;
}
