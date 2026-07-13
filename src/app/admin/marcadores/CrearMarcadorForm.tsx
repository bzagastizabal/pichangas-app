// Form de alta del marcador. Dos modos:
//  - Partido: puntajes por equipo, opcionalmente reloj/shot/periodo.
//  - Cronómetro: reloj gigante centrado con anuncios de voz automáticos.
'use client';

import { useActionState, useState } from 'react';
import { crearMarcador } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-xs text-tenue mb-1';

type Tipo = 'partido' | 'cronometro';

export function CrearMarcadorForm() {
  const [estado, formAction, pending] = useActionState(crearMarcador, {});
  const [tipo, setTipo] = useState<Tipo>('partido');
  const [conReloj, setConReloj] = useState(true);
  const [conShot, setConShot] = useState(true);
  const [conPeriodo, setConPeriodo] = useState(true);
  const modoMinimo = tipo === 'partido' && !conReloj && !conShot && !conPeriodo;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {/* Selector de tipo */}
      <div className="sm:col-span-2">
        <label className={label}>Tipo de marcador</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`cursor-pointer rounded-xl p-3 ring-1 transition ${
              tipo === 'partido'
                ? 'bg-orange-600/25 ring-orange-500/60'
                : 'bg-black/30 ring-white/10 hover:bg-black/50'
            }`}
          >
            <input
              type="radio"
              name="tipo_marcador"
              value="partido"
              checked={tipo === 'partido'}
              onChange={() => setTipo('partido')}
              className="sr-only"
            />
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">🏀</span>
              <div>
                <div className="text-sm font-semibold text-white">Partido</div>
                <div className="text-[0.65rem] text-tenue">Puntajes + reloj opcional</div>
              </div>
            </div>
          </label>
          <label
            className={`cursor-pointer rounded-xl p-3 ring-1 transition ${
              tipo === 'cronometro'
                ? 'bg-orange-600/25 ring-orange-500/60'
                : 'bg-black/30 ring-white/10 hover:bg-black/50'
            }`}
          >
            <input
              type="radio"
              name="tipo_marcador"
              value="cronometro"
              checked={tipo === 'cronometro'}
              onChange={() => setTipo('cronometro')}
              className="sr-only"
            />
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">🕐</span>
              <div>
                <div className="text-sm font-semibold text-white">Cronómetro</div>
                <div className="text-[0.65rem] text-tenue">Cuenta atrás con voz</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {tipo === 'partido' && (
        <>
          <div>
            <label className={label}>Nombre LOCAL</label>
            <input name="nombre_local" defaultValue="LOCAL" className={input} />
          </div>
          <div>
            <label className={label}>Nombre VISITANTE</label>
            <input name="nombre_visitante" defaultValue="VISITANTE" className={input} />
          </div>

          <div className="sm:col-span-2 rounded-lg bg-black/20 ring-1 ring-white/5 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tiene_reloj_periodo"
                checked={conReloj}
                onChange={(e) => setConReloj(e.target.checked)}
              />
              <span className="font-medium">Con reloj de periodo</span>
              <span className="text-xs text-tenue">(MM:SS por cuarto)</span>
            </label>
            {conReloj && (
              <div className="pl-6">
                <label className={label}>Duración del periodo (min)</label>
                <input
                  name="duracion_min"
                  type="number"
                  min={1}
                  defaultValue={10}
                  className={`${input} max-w-[10rem]`}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tiene_shot_clock"
                checked={conShot}
                onChange={(e) => setConShot(e.target.checked)}
              />
              <span className="font-medium">Con shot clock</span>
              <span className="text-xs text-tenue">(24/14 segundos)</span>
            </label>
            {conShot && (
              <div className="pl-6">
                <label className={label}>Shot clock (seg)</label>
                <input
                  name="shot_seg"
                  type="number"
                  min={1}
                  defaultValue={24}
                  className={`${input} max-w-[10rem]`}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tiene_periodo"
                checked={conPeriodo}
                onChange={(e) => setConPeriodo(e.target.checked)}
              />
              <span className="font-medium">Con indicador de periodo (Q)</span>
              <span className="text-xs text-tenue">(Q1, Q2, OT1…)</span>
            </label>

            {modoMinimo && (
              <p className="text-xs text-amber-300 pl-6">
                Modo &quot;máximo simple&quot;: solo nombres y puntajes. Los números y los
                nombres de equipo se renderizan más grandes para llenar la pantalla.
              </p>
            )}
            {!conReloj && !conShot && conPeriodo && (
              <p className="text-xs text-amber-300 pl-6">
                Modo &quot;solo contar puntos&quot;: el marcador mostrará nombres, periodo y puntaje.
              </p>
            )}
          </div>
        </>
      )}

      {tipo === 'cronometro' && (
        <>
          <div className="sm:col-span-2">
            <label className={label}>Nombre / Título (opcional)</label>
            <input
              name="titulo_cronometro"
              defaultValue=""
              placeholder="Ej. Calentamiento, Descanso, Prueba física"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Minutos</label>
            <input
              name="crono_min"
              type="number"
              min={0}
              defaultValue={5}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Segundos</label>
            <input
              name="crono_seg"
              type="number"
              min={0}
              max={59}
              defaultValue={0}
              className={input}
            />
          </div>
          <p className="sm:col-span-2 text-xs text-amber-300 pl-1">
            Anuncia por voz en 3/2/1 min, 30 s y cuenta detallada 10→1. La bocina
            suena al llegar a 0. Requiere que el visor active el sonido (🔇 → 🔊).
          </p>
        </>
      )}

      <div>
        <label className={label}>Expira en (horas)</label>
        <input
          name="horas_expiracion"
          type="number"
          min={1}
          defaultValue={24}
          className={input}
        />
      </div>

      <div className="sm:col-span-2">
        {estado.error && <p className="text-sm text-red-400 mb-2">{estado.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear y abrir control'}
        </button>
      </div>
    </form>
  );
}
