// src/app/admin/marcadores/[id]/control/ControlMarcador.tsx
// Panel de control: botones grandes para el operador. Se suscribe a Realtime
// para reflejar cambios externos (por si hay otro admin operando) y mantiene
// un reloj local que se decrementa via requestAnimationFrame para feedback.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatearReloj,
  msRestantes,
  type Marcador,
} from '@/lib/types';
import {
  cambiarFaltas,
  cambiarPeriodo,
  cambiarPuntos,
  cambiarTimeouts,
  reiniciarPartido,
  renombrarEquipos,
  resetReloj,
  resetShot,
  togglePlay,
} from './actions';

function HiddenId({ id }: { id: string }) {
  return <input type="hidden" name="id" value={id} />;
}

function Btn({
  children,
  variante = 'default',
}: {
  children: React.ReactNode;
  variante?: 'default' | 'primario' | 'peligro' | 'verde';
}) {
  const base = 'rounded-lg font-semibold transition active:scale-95';
  const v =
    variante === 'primario'
      ? 'bg-orange-600 text-white hover:bg-orange-500'
      : variante === 'peligro'
        ? 'bg-red-600 text-white hover:bg-red-500'
        : variante === 'verde'
          ? 'bg-green-600 text-white hover:bg-green-500'
          : 'bg-campo text-texto border border-borde hover:border-orange-500';
  return (
    <button type="submit" className={`${base} ${v} px-4 py-3 text-base`}>
      {children}
    </button>
  );
}

function BloqueEquipo({
  m,
  equipo,
}: {
  m: Marcador;
  equipo: 'local' | 'visitante';
}) {
  const nombre = equipo === 'local' ? m.nombre_local : m.nombre_visitante;
  const puntos = equipo === 'local' ? m.puntos_local : m.puntos_visitante;
  const faltas = equipo === 'local' ? m.faltas_local : m.faltas_visitante;
  const timeouts = equipo === 'local' ? m.timeouts_local : m.timeouts_visitante;
  const bonus = faltas >= 4;
  return (
    <div className="rounded-lg border border-borde p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold uppercase tracking-wide">{nombre}</h3>
        {bonus && <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">BONUS</span>}
      </div>
      <p className="text-5xl font-mono tabular-nums">{puntos}</p>
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3].map((d) => (
          <form key={d} action={cambiarPuntos}>
            <HiddenId id={m.id} />
            <input type="hidden" name="equipo" value={equipo} />
            <input type="hidden" name="delta" value={d} />
            <Btn variante="primario">+{d}</Btn>
          </form>
        ))}
        <form action={cambiarPuntos}>
          <HiddenId id={m.id} />
          <input type="hidden" name="equipo" value={equipo} />
          <input type="hidden" name="delta" value={-1} />
          <Btn>−1</Btn>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border border-borde p-2 text-center">
          <p className="text-tenue text-xs">Faltas</p>
          <p className="text-2xl font-mono">{faltas}</p>
          <div className="mt-1 flex gap-1 justify-center">
            <form action={cambiarFaltas}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={1} />
              <Btn>+1</Btn>
            </form>
            <form action={cambiarFaltas}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={-1} />
              <Btn>−1</Btn>
            </form>
          </div>
        </div>
        <div className="rounded border border-borde p-2 text-center">
          <p className="text-tenue text-xs">Timeouts</p>
          <p className="text-2xl font-mono">{timeouts}</p>
          <div className="mt-1 flex gap-1 justify-center">
            <form action={cambiarTimeouts}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={-1} />
              <Btn>Pidió</Btn>
            </form>
            <form action={cambiarTimeouts}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={1} />
              <Btn>+1</Btn>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ControlMarcador({ inicial }: { inicial: Marcador }) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const rafRef = useRef<number | null>(null);

  // Realtime: cualquier UPDATE de esta fila refresca el estado local.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`marcador:${inicial.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marcadores', filter: `id=eq.${inicial.id}` },
        (payload) => setM(payload.new as Marcador),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [inicial.id]);

  // Tick local del reloj (visual). El SSOT es la BD; aquí solo decrementamos.
  useEffect(() => {
    function tick() {
      setRelojMs(msRestantes(m.reloj_restante_ms, m.reloj_corriendo, m.reloj_inicio));
      setShotMs(msRestantes(m.shot_restante_ms, m.shot_corriendo, m.shot_inicio));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [m]);

  return (
    <div className="space-y-4">
      {/* Tiempo + shot + periodo + play */}
      <div className="rounded-lg border border-borde p-4 grid gap-3 sm:grid-cols-3 items-center">
        <div className="text-center">
          <p className="text-xs text-tenue">Tiempo</p>
          <p className="text-5xl font-mono tabular-nums">{formatearReloj(relojMs)}</p>
          <div className="mt-2 flex justify-center gap-2">
            <form action={resetReloj}>
              <HiddenId id={m.id} />
              <Btn>Reset</Btn>
            </form>
          </div>
        </div>
        <div className="text-center">
          <form action={togglePlay}>
            <HiddenId id={m.id} />
            <Btn variante={m.reloj_corriendo ? 'peligro' : 'verde'}>
              {m.reloj_corriendo ? '⏸ Pausa' : '▶ Play'}
            </Btn>
          </form>
          <div className="mt-3 flex items-center justify-center gap-2">
            <form action={cambiarPeriodo}>
              <HiddenId id={m.id} />
              <input type="hidden" name="delta" value={-1} />
              <Btn>−Q</Btn>
            </form>
            <span className="text-xl font-mono">Q{m.periodo}</span>
            <form action={cambiarPeriodo}>
              <HiddenId id={m.id} />
              <input type="hidden" name="delta" value={1} />
              <Btn>+Q</Btn>
            </form>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-tenue">Shot clock</p>
          <p className={`text-5xl font-mono tabular-nums ${shotMs < 5000 ? 'text-red-400' : ''}`}>
            {Math.ceil(shotMs / 1000)}
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <form action={resetShot}>
              <HiddenId id={m.id} />
              <input type="hidden" name="segundos" value={24} />
              <Btn>24</Btn>
            </form>
            <form action={resetShot}>
              <HiddenId id={m.id} />
              <input type="hidden" name="segundos" value={14} />
              <Btn>14</Btn>
            </form>
          </div>
        </div>
      </div>

      {/* Equipos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BloqueEquipo m={m} equipo="local" />
        <BloqueEquipo m={m} equipo="visitante" />
      </div>

      {/* Renombrar y reinicio total */}
      <div className="rounded-lg border border-borde p-4 space-y-3">
        <form action={renombrarEquipos} className="flex flex-wrap gap-2 items-end">
          <HiddenId id={m.id} />
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-tenue mb-1">Nombre LOCAL</label>
            <input
              name="nombre_local"
              defaultValue={m.nombre_local}
              className="border border-borde rounded px-2 py-1 bg-campo text-texto w-full"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-tenue mb-1">Nombre VISITANTE</label>
            <input
              name="nombre_visitante"
              defaultValue={m.nombre_visitante}
              className="border border-borde rounded px-2 py-1 bg-campo text-texto w-full"
            />
          </div>
          <button
            type="submit"
            className="bg-orange-600 text-white px-3 py-2 rounded text-sm"
          >
            Guardar nombres
          </button>
        </form>
        <form action={reiniciarPartido}>
          <HiddenId id={m.id} />
          <button
            type="submit"
            className="text-sm text-red-400 hover:underline"
            // Cuidado: doble-tap para evitar reinicios accidentales en táctil.
            onClick={(e) => {
              if (!confirm('¿Reiniciar el partido a 0–0 desde el primer periodo?')) {
                e.preventDefault();
              }
            }}
          >
            Reiniciar partido
          </button>
        </form>
      </div>
    </div>
  );
}
