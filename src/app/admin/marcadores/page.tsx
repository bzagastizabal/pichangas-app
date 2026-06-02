// src/app/admin/marcadores/page.tsx
// Lista de marcadores activos + creación. El link del visor es público; el del
// control solo lo ven los admins. Cada marcador tiene fecha de expiración
// (links expirables) y se puede eliminar.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import type { Marcador } from '@/lib/types';
import { CompartirEnlace } from '@/app/admin/CompartirEnlace';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { CrearMarcadorForm } from './CrearMarcadorForm';
import { eliminarMarcador, prorrogarMarcador } from './actions';

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default async function MarcadoresPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('marcadores')
    .select('*')
    .order('created_at', { ascending: false });
  const marcadores = (data as Marcador[]) ?? [];
  const base = await baseUrl();
  const ahora = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marcadores</h1>
        <p className="text-sm text-tenue">
          Tablero de marcador independiente para partidos amistosos. Tú operas
          desde el <strong>control</strong> y proyectas la <strong>pantalla pública</strong>
          en cualquier dispositivo con el enlace. Los links expiran y se pueden eliminar.
        </p>
      </div>

      <div className="rounded-lg border border-borde p-4">
        <h2 className="font-semibold mb-3">Crear marcador</h2>
        <CrearMarcadorForm />
      </div>

      {marcadores.length === 0 ? (
        <p className="text-tenue">Aún no tienes marcadores. Crea uno arriba.</p>
      ) : (
        <div className="space-y-4">
          {marcadores.map((m) => {
            const expirado = new Date(m.expira_en).getTime() < ahora;
            return (
              <div key={m.id} className="rounded-lg border border-borde p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {m.nombre_local} <span className="text-tenue">vs</span> {m.nombre_visitante}
                    </p>
                    <p className="text-xs text-tenue">
                      Q{m.periodo} · {m.puntos_local}–{m.puntos_visitante} ·
                      {' '}Expira {fechaCorta(m.expira_en)}
                      {expirado && <span className="ml-2 text-red-400">(expirado)</span>}
                    </p>
                  </div>
                </div>

                <CompartirEnlace
                  url={`${base}/marcador/${m.slug}`}
                  etiqueta="Pantalla pública"
                  waMensaje={
                    `🏀 Sigue el marcador en vivo: ${m.nombre_local} vs ${m.nombre_visitante} — ` +
                    `${base}/marcador/${m.slug}`
                  }
                />

                <div className="flex flex-wrap items-center gap-4 border-t border-borde pt-3 text-sm">
                  <Link
                    href={`/admin/marcadores/${m.id}/control`}
                    className="text-orange-400 hover:underline"
                  >
                    Abrir control
                  </Link>
                  <Link
                    href={`/marcador/${m.slug}`}
                    target="_blank"
                    className="text-orange-400 hover:underline"
                  >
                    Abrir pantalla ↗
                  </Link>
                  <form action={prorrogarMarcador} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      type="number"
                      name="horas"
                      defaultValue={24}
                      min={1}
                      className="border border-borde rounded px-1 py-0.5 bg-campo text-xs w-16"
                    />
                    <button type="submit" className="text-tenue hover:underline">
                      Prorrogar h
                    </button>
                  </form>
                  <BotonEliminar
                    action={eliminarMarcador}
                    id={m.id}
                    nombre={`marcador ${m.nombre_local} vs ${m.nombre_visitante}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
