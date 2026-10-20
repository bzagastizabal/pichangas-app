// src/app/admin/marcadores/[id]/control/page.tsx
// Panel de control del marcador. Protegido por requireAdmin (vía layout admin).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import type { Marcador } from '@/lib/types';
import { ControlMarcador } from './ControlMarcador';
import { LinkOperador } from './LinkOperador';

export default async function ControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('marcadores').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const inicial = data as Marcador;
  const base = await baseUrl();

  // Clave del link de operador (SQL 39). Tabla aparte con RLS solo-admin: el
  // visor público nunca la ve. Si la migración no corrió, no hay fila y el
  // bloque simplemente no se muestra.
  const { data: claveRow } = await supabase
    .from('marcador_claves')
    .select('clave')
    .eq('marcador_id', id)
    .maybeSingle();
  const claveOperador = (claveRow as { clave: string } | null)?.clave ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/marcadores" className="text-sm text-tenue hover:underline">
          ← Marcadores
        </Link>
        <h1 className="text-2xl font-bold">
          Control: {inicial.nombre_local} vs {inicial.nombre_visitante}
        </h1>
        <p className="text-xs text-tenue">
          Pantalla pública:{' '}
          <a
            href={`${base}/marcador/${inicial.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            {base}/marcador/{inicial.slug}
          </a>
        </p>
      </div>
      {inicial.es_cronometro && claveOperador && (
        <LinkOperador
          id={inicial.id}
          url={`${base}/marcador/${inicial.slug}?op=${claveOperador}`}
        />
      )}

      <ControlMarcador inicial={inicial} />
    </div>
  );
}
