// src/app/admin/marcadores/[id]/control/ControlMarcador.tsx
// Panel de control. Botones grandes (44px+) coherentes con el visor: misma
// paleta naranja/sky por equipo, tipografía Orbitron en los displays y feedback
// táctil (active:scale). Se suscribe a Realtime para sincronizarse si otro
// admin opera en paralelo.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormHTMLAttributes } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatearReloj, msRestantes, type Marcador } from '@/lib/types';
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

// ---- Helpers de botones --------------------------------------------------

function HiddenId({ id }: { id: string }) {
  return <input type="hidden" name="id" value={id} />;
}

type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  action: (formData: FormData) => void | Promise<void>;
};
function FormBtn(props: FormProps) {
  return <form {...props} className={`contents ${props.className ?? ''}`} />;
}

type Tono = 'neutro' | 'primario' | 'verde' | 'rojo' | 'azul';
const TONOS: Record<Tono, string> = {
  neutro:   'bg-zinc-800/80 ring-1 ring-white/10 text-zinc-100 hover:bg-zinc-700/80',
  primario: 'bg-orange-600 ring-1 ring-orange-400/40 text-white hover:bg-orange-500',
  verde:    'bg-green-600 ring-1 ring-green-400/40 text-white hover:bg-green-500',
  rojo:     'bg-red-600 ring-1 ring-red-400/40 text-white hover:bg-red-500',
  azul:     'bg-sky-600 ring-1 ring-sky-400/40 text-white hover:bg-sky-500',
};

function Boton({
  children,
  tono = 'neutro',
  alto = 'normal',
  ancho = 'auto',
  className = '',
}: {
  children: React.ReactNode;
  tono?: Tono;
  alto?: 'normal' | 'alto';
  ancho?: 'auto' | 'full';
  className?: string;
}) {
  const h = alto === 'alto' ? 'h-14 sm:h-16 text-lg sm:text-xl' : 'h-11 sm:h-12 text-sm sm:text-base';
  const w = ancho === 'full' ? 'w-full' : '';
  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-xl font-bold tracking-wide transition active:scale-[0.97] disabled:opacity-50 ${TONOS[tono]} ${h} ${w} ${className}`}
    >
      {children}
    </button>
  );
}

// ---- Bloque por equipo ---------------------------------------------------

type Lado = 'local' | 'visitante';
const ACCENT: Record<Lado, { txt: string; ring: string; chip: string; line: string }> = {
  local: {
    txt: 'text-orange-300',
    ring: 'ring-orange-500/30',
    chip: 'bg-orange-500/15 ring-orange-400/40 text-orange-200',
    line: 'bg-orange-500',
  },
  visitante: {
    txt: 'text-sky-300',
    ring: 'ring-sky-500/30',
    chip: 'bg-sky-500/15 ring-sky-400/40 text-sky-200',
    line: 'bg-sky-500',
  },
};

function BloqueEquipo({ m, equipo }: { m: Marcador; equipo: Lado }) {
  const nombre = equipo === 'local' ? m.nombre_local : m.nombre_visitante;
  const puntos = equipo === 'local' ? m.puntos_local : m.puntos_visitante;
  const faltas = equipo === 'local' ? m.faltas_local : m.faltas_visitante;
  const timeouts = equipo === 'local' ? m.timeouts_local : m.timeouts_visitante;
  const bonus = faltas >= 4;
  const a = ACCENT[equipo];
  const tonoPlus: Tono = equipo === 'local' ? 'primario' : 'azul';

  return (
    <div className={`rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ${a.ring} p-4 sm:p-5 space-y-4`}>
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-1 w-8 rounded-full ${a.line}`} />
          <h3 className={`font-bold uppercase tracking-widest truncate ${a.txt}`}>
            {nombre}
          </h3>
        </div>
        {bonus && (
          <span className="rounded-full bg-red-500/15 ring-1 ring-red-400/40 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-red-300 animate-pulse">
            Bonus
          </span>
        )}
      </div>

      {/* Puntaje */}
      <p className="font-orbitron font-black tabular-nums text-white text-6xl sm:text-7xl text-center leading-none">
        {puntos}
      </p>

      {/* Botones de puntos */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3].map((d) => (
          <FormBtn key={d} action={cambiarPuntos}>
            <HiddenId id={m.id} />
            <input type="hidden" name="equipo" value={equipo} />
            <input type="hidden" name="delta" value={d} />
            <Boton tono={tonoPlus} alto="alto" ancho="full">+{d}</Boton>
          </FormBtn>
        ))}
        <FormBtn action={cambiarPuntos}>
          <HiddenId id={m.id} />
          <input type="hidden" name="equipo" value={equipo} />
          <input type="hidden" name="delta" value={-1} />
          <Boton tono="rojo" alto="alto" ancho="full">−1</Boton>
        </FormBtn>
      </div>

      {/* Faltas y Timeouts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/30 ring-1 ring-white/5 p-3 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Faltas</p>
          <p className={`font-orbitron font-bold tabular-nums text-3xl my-1 ${bonus ? 'text-red-300' : 'text-zinc-100'}`}>
            {faltas}
          </p>
          <div className="flex gap-2">
            <FormBtn action={cambiarFaltas}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={1} />
              <Boton tono="neutro" ancho="full">+1</Boton>
            </FormBtn>
            <FormBtn action={cambiarFaltas}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={-1} />
              <Boton tono="neutro" ancho="full">−1</Boton>
            </FormBtn>
          </div>
        </div>
        <div className="rounded-xl bg-black/30 ring-1 ring-white/5 p-3 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Timeouts</p>
          <p className="font-orbitron font-bold tabular-nums text-3xl my-1 text-zinc-100">
            {timeouts}
          </p>
          <div className="flex gap-2">
            <FormBtn action={cambiarTimeouts}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={-1} />
              <Boton tono="neutro" ancho="full">Pidió</Boton>
            </FormBtn>
            <FormBtn action={cambiarTimeouts}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={1} />
              <Boton tono="neutro" ancho="full">+1</Boton>
            </FormBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Iconos SVG simples --------------------------------------------------

function IconoPlay({ pausa }: { pausa: boolean }) {
  return pausa ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 sm:h-6 sm:w-6">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 sm:h-6 sm:w-6">
      <path d="M8 5l11 7-11 7V5z" />
    </svg>
  );
}

// ---- Componente principal ------------------------------------------------

export function ControlMarcador({ inicial }: { inicial: Marcador }) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const rafRef = useRef<number | null>(null);

  // Realtime
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

  // Tick local
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

  const relojBajo = relojMs < 60_000 && m.reloj_corriendo;
  const shotPeligro = shotMs < 5000 && m.shot_corriendo;
  const periodoEtiqueta = m.periodo <= 4 ? `Q${m.periodo}` : `OT${m.periodo - 4}`;
  // Fallback para marcadores creados antes de SQL 22 (los flags llegan nulos).
  const conReloj: boolean = m.tiene_reloj_periodo ?? true;
  const conShot: boolean = m.tiene_shot_clock ?? true;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Mini-identidad + estado */}
      <div className="flex items-center gap-3 text-sm">
        <Image
          src="/cmt_insignia.png"
          alt="CMT BasketBall Club"
          width={48}
          height={48}
          className="h-9 w-9 drop-shadow-[0_0_12px_rgba(251,146,60,0.4)]"
        />
        <div className="leading-tight">
          <p className="font-semibold uppercase tracking-widest text-zinc-200">
            CMT BasketBall Club
          </p>
          <p className="text-xs text-tenue uppercase tracking-widest">Panel de control</p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ring-1 ${
            m.reloj_corriendo
              ? 'bg-red-500/15 ring-red-500/40 text-red-200'
              : 'bg-white/5 ring-white/15 text-zinc-300'
          }`}
        >
          <span className="relative inline-flex h-2 w-2">
            {m.reloj_corriendo && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${m.reloj_corriendo ? 'bg-red-500' : 'bg-zinc-500'}`} />
          </span>
          {m.reloj_corriendo ? 'LIVE' : 'PAUSA'}
        </span>
      </div>

      {/* HERO: Tiempo / Play / Shot / Periodo */}
      <div className="rounded-2xl bg-gradient-to-b from-tarjeta/80 to-black/60 backdrop-blur ring-1 ring-white/10 p-4 sm:p-6">
        <div
          className={`grid gap-4 items-center ${
            conReloj && conShot
              ? 'lg:grid-cols-[1fr_auto_1fr]'
              : conReloj || conShot
                ? 'lg:grid-cols-[1fr_auto]'
                : 'lg:grid-cols-1'
          }`}
        >
          {/* Tiempo (solo si está activado) */}
          {conReloj && (
            <div className="text-center lg:text-left">
              <p className="text-xs text-tenue uppercase tracking-[0.3em]">Tiempo de juego</p>
              <p
                className={`font-orbitron font-black tabular-nums leading-none mt-1 ${relojBajo ? 'animate-glow-soft' : ''}`}
                style={{
                  fontSize: 'clamp(3.5rem, 9vw, 6rem)',
                  color: relojBajo ? '#ef4444' : '#ffffff',
                  textShadow: relojBajo
                    ? '0 0 24px rgba(239,68,68,0.6)'
                    : '0 0 18px rgba(255,255,255,0.25)',
                }}
              >
                {formatearReloj(relojMs)}
              </p>
              <div className="mt-2 flex justify-center lg:justify-start gap-2">
                <FormBtn action={resetReloj}>
                  <HiddenId id={m.id} />
                  <Boton tono="neutro">↻ Reset reloj</Boton>
                </FormBtn>
              </div>
            </div>
          )}

          {/* Play + Periodo. Play solo si hay algún cronómetro. */}
          <div className="flex flex-col items-center gap-3">
            {(conReloj || conShot) && (
              <FormBtn action={togglePlay}>
                <HiddenId id={m.id} />
                <button
                  type="submit"
                  className={`relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full text-white font-bold transition active:scale-[0.96] ring-2 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
                    m.reloj_corriendo
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                  aria-label={m.reloj_corriendo ? 'Pausar' : 'Iniciar'}
                >
                  <IconoPlay pausa={m.reloj_corriendo} />
                </button>
              </FormBtn>
            )}
            <div className="flex items-center gap-2">
              <FormBtn action={cambiarPeriodo}>
                <HiddenId id={m.id} />
                <input type="hidden" name="delta" value={-1} />
                <Boton tono="neutro">−Q</Boton>
              </FormBtn>
              <span className="font-orbitron font-bold text-2xl text-orange-300 min-w-[3.5rem] text-center">
                {periodoEtiqueta}
              </span>
              <FormBtn action={cambiarPeriodo}>
                <HiddenId id={m.id} />
                <input type="hidden" name="delta" value={1} />
                <Boton tono="neutro">+Q</Boton>
              </FormBtn>
            </div>
          </div>

          {/* Shot (solo si está activado) */}
          {conShot && (
            <div className="text-center lg:text-right">
              <p className="text-xs text-tenue uppercase tracking-[0.3em]">Shot clock</p>
              <p
                className={`font-orbitron font-black tabular-nums leading-none mt-1 ${shotPeligro ? 'animate-glow-soft' : ''}`}
                style={{
                  fontSize: 'clamp(3.5rem, 9vw, 6rem)',
                  color: shotPeligro ? '#ef4444' : '#fbbf24',
                  textShadow: shotPeligro
                    ? '0 0 24px rgba(239,68,68,0.6)'
                    : '0 0 18px rgba(251,191,36,0.4)',
                }}
              >
                {Math.ceil(shotMs / 1000)}
              </p>
              <div className="mt-2 flex justify-center lg:justify-end gap-2">
                <FormBtn action={resetShot}>
                  <HiddenId id={m.id} />
                  <input type="hidden" name="segundos" value={24} />
                  <Boton tono="primario">↻ 24</Boton>
                </FormBtn>
                <FormBtn action={resetShot}>
                  <HiddenId id={m.id} />
                  <input type="hidden" name="segundos" value={14} />
                  <Boton tono="primario">↻ 14</Boton>
                </FormBtn>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Equipos */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <BloqueEquipo m={m} equipo="local" />
        <BloqueEquipo m={m} equipo="visitante" />
      </div>

      {/* Configuración: renombrar + reinicio */}
      <div className="rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ring-white/10 p-4 sm:p-5 space-y-4">
        <form action={renombrarEquipos} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <HiddenId id={m.id} />
          <div>
            <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">Nombre LOCAL</label>
            <input
              name="nombre_local"
              defaultValue={m.nombre_local}
              className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">Nombre VISITANTE</label>
            <input
              name="nombre_visitante"
              defaultValue={m.nombre_visitante}
              className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
            />
          </div>
          <Boton tono="primario">Guardar nombres</Boton>
        </form>
        <form action={reiniciarPartido}>
          <HiddenId id={m.id} />
          <button
            type="submit"
            className="text-sm text-red-400 hover:underline"
            onClick={(e) => {
              if (!confirm('¿Reiniciar el partido a 0–0 desde el primer periodo?')) {
                e.preventDefault();
              }
            }}
          >
            ↺ Reiniciar partido
          </button>
        </form>
      </div>
    </div>
  );
}
