// src/app/admin/sonidos/page.tsx
// Biblioteca de efectos del cronómetro (SQL 40). Lo que esté activo aparece
// en el panel 🔊 Sonidos de TODOS los cronómetros, incluido el link público
// de operador (ahí solo se usan, no se editan).
import { createClient } from '@/lib/supabase/server';
import { urlPublica } from '@/lib/storage';
import { BUCKET_EFECTOS, type EfectoSonido } from '@/lib/sonidos';
import { BotonSubmit } from '@/components/BotonSubmit';
import {
  actualizarEfecto,
  alternarEfecto,
  eliminarEfecto,
  subirEfectos,
} from './actions';

const input = 'border border-borde p-2 rounded bg-campo text-texto text-sm';

export default async function SonidosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('efectos_sonido')
    .select('*')
    .order('orden')
    .order('created_at');
  const efectos = (data as EfectoSonido[]) ?? [];
  const activos = efectos.filter((e) => e.activo).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sonidos del cronómetro</h1>
        <p className="text-sm text-tenue mt-1">
          Efectos para cuando alguien encesta, falla o toca molestar. Aparecen en el
          panel 🔊 Sonidos de cualquier cronómetro y suenan en el equipo que proyecta.
          {efectos.length > 0 && ` · ${activos} de ${efectos.length} activos`}
        </p>
      </div>

      <form
        action={subirEfectos}
        encType="multipart/form-data"
        className="rounded-xl border border-orange-500/30 bg-orange-600/10 p-4 space-y-2"
      >
        <p className="text-sm font-semibold">Subir efectos</p>
        <p className="text-xs text-tenue">
          MP3, WAV, OGG o M4A — hasta 3 MB cada uno. Lo ideal son clips de 1 a 3
          segundos. El nombre sale del archivo y lo puedes editar abajo.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" name="archivos" accept="audio/*" multiple required className="text-xs" />
          <BotonSubmit
            className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
            pendiente="Subiendo…"
          >
            Subir
          </BotonSubmit>
        </div>
      </form>

      {efectos.length === 0 ? (
        <p className="text-sm text-tenue">Todavía no hay efectos.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {efectos.map((e) => (
            <li
              key={e.id}
              className={`rounded-xl border p-3 space-y-2 ${
                e.activo ? 'border-borde' : 'border-borde/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{e.emoji || '🔊'}</span>
                <p className="font-semibold truncate">{e.nombre}</p>
              </div>

              <audio
                controls
                preload="none"
                src={urlPublica(BUCKET_EFECTOS, e.path)}
                className="h-8 w-full"
              />

              <form action={actualizarEfecto} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={e.id} />
                <div className="grow min-w-[8rem]">
                  <label className="block text-[0.7rem] text-tenue mb-1">Nombre</label>
                  <input name="nombre" defaultValue={e.nombre} className={`${input} w-full`} />
                </div>
                <div className="w-16">
                  <label className="block text-[0.7rem] text-tenue mb-1">Emoji</label>
                  <input name="emoji" defaultValue={e.emoji ?? ''} className={`${input} w-full`} />
                </div>
                <div className="w-16">
                  <label className="block text-[0.7rem] text-tenue mb-1">Orden</label>
                  <input
                    name="orden"
                    type="number"
                    defaultValue={e.orden}
                    className={`${input} w-full`}
                  />
                </div>
                <BotonSubmit className="bg-orange-600 text-white px-3 py-2 rounded text-xs">
                  Guardar
                </BotonSubmit>
              </form>

              <div className="flex items-center gap-2">
                <form action={alternarEfecto}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="activo" value={String(e.activo)} />
                  <button
                    type="submit"
                    className="rounded px-3 py-1.5 text-xs ring-1 ring-white/15 text-zinc-300 hover:bg-white/5"
                  >
                    {e.activo ? '🚫 Desactivar' : '✓ Activar'}
                  </button>
                </form>
                <form action={eliminarEfecto}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="rounded px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/10"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
