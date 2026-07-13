// src/app/admin/marcadores/[id]/control/ControlMarcador.tsx
// Panel de control. Botones grandes (44px+) coherentes con el visor: misma
// paleta naranja/sky por equipo, tipografía Orbitron en los displays y feedback
// táctil (active:scale). Se suscribe a Realtime para sincronizarse si otro
// admin opera en paralelo.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormHTMLAttributes } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { formatearReloj, msRestantes, type Marcador } from '@/lib/types';
import {
  aplicarEventoFast,
  canalFast,
  type EventoFast,
} from '@/lib/marcador-broadcast';
import {
  desbloquearAudio,
  tocarBocina,
  type BocinaTipo,
} from '@/lib/audio-marcador';

// Catálogo de bocinas (sync con SQL 34 y audio-marcador.ts).
const BOCINAS: Array<{
  key: BocinaTipo;
  emoji: string;
  label: string;
  hint: string;
}> = [
  { key: 'ncaa',        emoji: '🏟️', label: 'NCAA',        hint: 'Universitario, grave con vibrato leve' },
  { key: 'nba',         emoji: '🏀', label: 'NBA',         hint: 'Arena pro — más grave y con wobble' },
  { key: 'high_school', emoji: '🏫', label: 'High school', hint: 'Aguda y seca, gym de colegio' },
  { key: 'air_horn',    emoji: '📢', label: 'Air horn',    hint: 'Festivalero, aguda y brillante' },
];
import {
  actualizarEstilo,
  ajustarCronometro,
  cambiarFaltas,
  cambiarPeriodo,
  cambiarPuntos,
  cambiarTimeouts,
  reiniciarPartido,
  renombrarEquipos,
  resetReloj,
  resetShot,
  sonarBocina,
  togglePlay,
} from './actions';

// Sub-form del estilo: fuente + colores. Radio controlado con useState para
// que la selección se sienta al instante (antes era uncontrolled y el ring
// visual se quedaba pegado al valor persistido en la DB). Los color pickers
// también son controlados para que "Alto contraste LED" actualice la UI.
function FormEstilo({ m }: { m: Marcador }) {
  const [fuenteSel, setFuenteSel] = useState<ClaveFuente>(
    (m.fuente as ClaveFuente | undefined) ?? 'orbitron',
  );
  const [cpl, setCpl] = useState<string>(m.color_puntos_local ?? '#ffffff');
  const [cpv, setCpv] = useState<string>(m.color_puntos_visitante ?? '#ffffff');
  const [cfondo, setCfondo] = useState<string>(m.color_fondo ?? '#000000');
  const [neon, setNeon] = useState<boolean>(m.neon ?? false);
  const [bocinaSel, setBocinaSel] = useState<BocinaTipo>(
    (m.bocina_tipo as BocinaTipo | undefined) ?? 'ncaa',
  );
  // Sincroniza si otro admin cambia el estilo desde otra sesión (postgres_changes).
  useEffect(() => {
    if (m.fuente) setFuenteSel(m.fuente as ClaveFuente);
    if (m.color_puntos_local)     setCpl(m.color_puntos_local);
    if (m.color_puntos_visitante) setCpv(m.color_puntos_visitante);
    if (m.color_fondo)            setCfondo(m.color_fondo);
    if (typeof m.neon === 'boolean') setNeon(m.neon);
    if (m.bocina_tipo) setBocinaSel(m.bocina_tipo as BocinaTipo);
  }, [m.fuente, m.color_puntos_local, m.color_puntos_visitante, m.color_fondo, m.neon, m.bocina_tipo]);

  // Preview del sonido — el click es user-gesture, así que podemos desbloquear
  // audio e inmediatamente reproducir la variante para que el admin la escuche.
  async function previewBocina(tipo: BocinaTipo) {
    await desbloquearAudio();
    tocarBocina(false, tipo);
  }

  // Presets pensados para PROYECTOR de bajos lúmenes.
  // Regla de brillo en DLP/LCD: blanco > amarillo > verde > cyan > rojo > azul.
  // Con neón encendido el halo aumenta el área luminosa sin perder contraste.
  function presetBlanco() {
    // Máximo brillo posible — recomendado.
    setFuenteSel('led'); setCpl('#ffffff'); setCpv('#ffffff'); setCfondo('#000000'); setNeon(true);
  }
  function presetVerde() {
    // Segundo más brillante, look clásico LED de estadio.
    setFuenteSel('led'); setCpl('#39ff14'); setCpv('#39ff14'); setCfondo('#000000'); setNeon(true);
  }
  function presetAmbar() {
    setFuenteSel('led'); setCpl('#ffb300'); setCpv('#ffb300'); setCfondo('#000000'); setNeon(true);
  }
  function presetRojo() {
    // Rojo LED clásico — bonito pero apagado en proyectores baratos.
    setFuenteSel('led'); setCpl('#ff2a2a'); setCpv('#ff2a2a'); setCfondo('#000000'); setNeon(true);
  }

  return (
    <form action={actualizarEstilo} className="space-y-3 border-t border-white/5 pt-4">
      <HiddenId id={m.id} />
      {/* Presets rápidos para alto contraste en proyector. */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-tenue mr-1">Presets:</span>
          <button
            type="button"
            onClick={presetBlanco}
            className="rounded-full bg-white/10 ring-1 ring-white/40 text-white px-3 py-1 text-xs font-bold hover:bg-white/20"
            title="Máximo brillo — recomendado para proyector de bajos lúmenes"
          >
            ⚪ LED Blanco ⭐
          </button>
          <button
            type="button"
            onClick={presetVerde}
            className="rounded-full bg-green-600/20 ring-1 ring-green-500/40 text-green-200 px-3 py-1 text-xs font-bold hover:bg-green-600/30"
          >
            🟢 LED Verde
          </button>
          <button
            type="button"
            onClick={presetAmbar}
            className="rounded-full bg-amber-600/20 ring-1 ring-amber-500/40 text-amber-200 px-3 py-1 text-xs font-bold hover:bg-amber-600/30"
          >
            🟡 LED Ámbar
          </button>
          <button
            type="button"
            onClick={presetRojo}
            className="rounded-full bg-red-600/20 ring-1 ring-red-500/40 text-red-200 px-3 py-1 text-xs font-bold hover:bg-red-600/30"
          >
            🔴 LED Rojo
          </button>
        </div>
        <p className="text-[0.65rem] text-tenue/80 pl-1">
          Para proyector de bajos lúmenes usá <b className="text-white">Blanco</b> o <b className="text-green-300">Verde</b> — son 2-3× más brillantes que rojo/azul en proyectores DLP/LCD.
        </p>
      </div>

      {/* Selector de bocina — cada opción tiene botón ▶ para pre-escuchar. */}
      <div>
        <label className="block text-xs text-tenue mb-2 uppercase tracking-widest">
          Bocina
        </label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {BOCINAS.map((b) => {
            const activa = bocinaSel === b.key;
            return (
              <div
                key={b.key}
                className={`rounded-xl p-3 ring-1 transition ${
                  activa
                    ? 'bg-orange-600/25 ring-orange-500/60'
                    : 'bg-black/30 ring-white/10 hover:bg-black/50'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bocina_tipo"
                    value={b.key}
                    checked={activa}
                    onChange={() => setBocinaSel(b.key)}
                    className="sr-only"
                  />
                  <span className="text-2xl leading-none">{b.emoji}</span>
                  <span className="flex-1 text-sm font-semibold text-white truncate">{b.label}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); previewBocina(b.key); }}
                    title={`Pre-escuchar ${b.label}`}
                    className="rounded-full bg-white/10 ring-1 ring-white/20 hover:bg-white/20 w-8 h-8 inline-flex items-center justify-center text-white text-xs font-bold"
                  >
                    ▶
                  </button>
                </label>
                <p className="mt-1 text-[0.65rem] text-tenue leading-tight">{b.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Neón: halo brillante alrededor del puntaje. */}
      <label className="flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/5 p-3 cursor-pointer">
        <input
          type="checkbox"
          name="neon"
          checked={neon}
          onChange={(e) => setNeon(e.target.checked)}
          className="h-5 w-5 accent-orange-500"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Efecto neón (halo brillante)</div>
          <div className="text-[0.7rem] text-tenue">
            Multiplica el área luminosa del puntaje sin cambiar el color. Recomendado en proyectores oscuros.
          </div>
        </div>
      </label>

      <div>
        <label className="block text-xs text-tenue mb-2 uppercase tracking-widest">
          Fuente de los números
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {FUENTES.map((f) => {
            const activa = fuenteSel === f.key;
            return (
              <label
                key={f.key}
                className={`cursor-pointer rounded-xl px-2 py-3 text-center ring-1 transition ${
                  activa
                    ? 'bg-orange-600/25 ring-orange-500/60'
                    : 'bg-black/30 ring-white/10 hover:bg-black/50'
                }`}
              >
                <input
                  type="radio"
                  name="fuente"
                  value={f.key}
                  checked={activa}
                  onChange={() => setFuenteSel(f.key)}
                  className="sr-only"
                />
                <div className={`${f.cls} text-3xl leading-none tabular-nums text-white`}>
                  {f.demo}
                </div>
                <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-tenue">
                  {f.label}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">
            Puntos LOCAL
          </label>
          <input
            name="color_puntos_local"
            type="color"
            value={cpl}
            onChange={(e) => setCpl(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-lg border border-borde bg-campo p-1"
          />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">
            Puntos VISITANTE
          </label>
          <input
            name="color_puntos_visitante"
            type="color"
            value={cpv}
            onChange={(e) => setCpv(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-lg border border-borde bg-campo p-1"
          />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">
            Fondo
          </label>
          <input
            name="color_fondo"
            type="color"
            value={cfondo}
            onChange={(e) => setCfondo(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-lg border border-borde bg-campo p-1"
          />
        </div>
      </div>

      <div>
        <Boton tono="primario">Aplicar estilo</Boton>
      </div>
    </form>
  );
}

// Catálogo de fuentes disponibles (sync con SQL 31 y next/font en layout).
type ClaveFuente = 'orbitron' | 'bebas' | 'anton' | 'iceland' | 'rubik_mono' | 'led';
const FUENTES: Array<{
  key: ClaveFuente;
  label: string;
  cls: string;
  demo: string;
}> = [
  { key: 'orbitron',   label: 'Orbitron',      cls: 'font-orbitron',   demo: '88' },
  { key: 'bebas',      label: 'Bebas Neue',    cls: 'font-bebas',      demo: '88' },
  { key: 'anton',      label: 'Anton',         cls: 'font-anton',      demo: '88' },
  { key: 'iceland',    label: 'Iceland',       cls: 'font-iceland',    demo: '88' },
  { key: 'rubik_mono', label: 'Rubik Mono',    cls: 'font-rubik-mono', demo: '88' },
  { key: 'led',        label: 'LED 7-seg',     cls: 'font-led',        demo: '88' },
];

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

function BloqueEquipo({ m, equipo, fast }: { m: Marcador; equipo: Lado; fast: FastFn }) {
  const nombre = equipo === 'local' ? m.nombre_local : m.nombre_visitante;
  const puntos = equipo === 'local' ? m.puntos_local : m.puntos_visitante;
  const faltas = equipo === 'local' ? m.faltas_local : m.faltas_visitante;
  const timeouts = equipo === 'local' ? m.timeouts_local : m.timeouts_visitante;
  const bonus = faltas >= 4;
  const a = ACCENT[equipo];
  const tonoPlus: Tono = equipo === 'local' ? 'primario' : 'azul';
  const eq: 'l' | 'v' = equipo === 'local' ? 'l' : 'v';

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
          <FormBtn key={d} action={fast(cambiarPuntos, { t: 'pts', eq, d })}>
            <HiddenId id={m.id} />
            <input type="hidden" name="equipo" value={equipo} />
            <input type="hidden" name="delta" value={d} />
            <Boton tono={tonoPlus} alto="alto" ancho="full">+{d}</Boton>
          </FormBtn>
        ))}
        <FormBtn action={fast(cambiarPuntos, { t: 'pts', eq, d: -1 })}>
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
            <FormBtn action={fast(cambiarFaltas, { t: 'fal', eq, d: 1 })}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={1} />
              <Boton tono="neutro" ancho="full">+1</Boton>
            </FormBtn>
            <FormBtn action={fast(cambiarFaltas, { t: 'fal', eq, d: -1 })}>
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
            <FormBtn action={fast(cambiarTimeouts, { t: 'to', eq, d: -1 })}>
              <HiddenId id={m.id} />
              <input type="hidden" name="equipo" value={equipo} />
              <input type="hidden" name="delta" value={-1} />
              <Boton tono="neutro" ancho="full">Pidió</Boton>
            </FormBtn>
            <FormBtn action={fast(cambiarTimeouts, { t: 'to', eq, d: 1 })}>
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

// Wrapper de acción que añade un broadcast predicho ANTES del Server Action y
// aplica el evento optimistamente al estado local. Si el server diverge,
// postgres_changes corrige al llegar (fuente de verdad). Tipado parametrizado
// para no perder la firma del Server Action.
type Accion = (fd: FormData) => void | Promise<void>;
type FastFn = <A extends Accion>(accion: A, evOrFn: EventoFast | (() => EventoFast)) => A;

export function ControlMarcador({ inicial }: { inicial: Marcador }) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const rafRef = useRef<number | null>(null);
  const fastRef = useRef<RealtimeChannel | null>(null);

  // Realtime — postgres_changes para reconciliar + broadcast fast-lane (~30-80 ms).
  useEffect(() => {
    const supabase = createClient();
    const chDb = supabase
      .channel(`marcador:${inicial.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marcadores', filter: `id=eq.${inicial.id}` },
        (payload) => setM(payload.new as Marcador),
      )
      .subscribe();
    const chFast = supabase
      .channel(canalFast(inicial.id))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fastRef.current = chFast;
      });
    return () => {
      fastRef.current = null;
      supabase.removeChannel(chDb);
      supabase.removeChannel(chFast);
    };
  }, [inicial.id]);

  const fast: FastFn = (accion, evOrFn) => {
    return ((fd: FormData) => {
      const ev = typeof evOrFn === 'function' ? evOrFn() : evOrFn;
      // Optimistic local (control) + broadcast al visor.
      setM((prev) => aplicarEventoFast(prev, ev));
      fastRef.current?.send({ type: 'broadcast', event: 'ev', payload: ev });
      return accion(fd);
    }) as typeof accion;
  };

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
  const conPeriodo: boolean = m.tiene_periodo ?? true;
  const esCronometro: boolean = m.es_cronometro ?? false;

  // --- Modo cronómetro: UI dedicada ---------------------------------------
  if (esCronometro) {
    const mm = Math.floor(relojMs / 60_000);
    const ss = Math.floor((relojMs % 60_000) / 1000);
    return (
      <div className="space-y-4">
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
              Cronómetro
            </p>
            {m.titulo && <p className="text-xs text-tenue truncate max-w-[24ch]">{m.titulo}</p>}
          </div>
          <span
            className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ring-1 ${
              m.reloj_corriendo
                ? 'bg-red-500/15 ring-red-500/40 text-red-200'
                : 'bg-white/5 ring-white/15 text-zinc-300'
            }`}
          >
            {m.reloj_corriendo ? 'LIVE' : 'PAUSA'}
          </span>
        </div>

        {/* Display grande */}
        <div className="rounded-2xl bg-gradient-to-b from-tarjeta/80 to-black/60 backdrop-blur ring-1 ring-white/10 p-6 text-center">
          <p
            className={`font-orbitron font-black tabular-nums leading-none ${
              relojBajo ? 'animate-glow-soft' : ''
            }`}
            style={{
              fontSize: 'clamp(4.5rem, 22vw, 12rem)',
              color: relojBajo ? '#ef4444' : '#ffffff',
              textShadow: relojBajo
                ? '0 0 30px rgba(239,68,68,0.7)'
                : '0 0 20px rgba(255,255,255,0.3)',
            }}
          >
            {mm}:{ss.toString().padStart(2, '0')}
          </p>
        </div>

        {/* Play grande + reset */}
        <div className="flex flex-col items-center gap-3">
          <FormBtn action={fast(togglePlay, () => ({ t: 'play', nowMs: Date.now() }))}>
            <HiddenId id={m.id} />
            <button
              type="submit"
              className={`relative inline-flex h-24 w-24 items-center justify-center rounded-full text-white font-bold transition active:scale-[0.96] ring-2 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
                m.reloj_corriendo ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
              }`}
              aria-label={m.reloj_corriendo ? 'Pausar' : 'Iniciar'}
            >
              <IconoPlay pausa={m.reloj_corriendo} />
            </button>
          </FormBtn>
          <FormBtn action={fast(resetReloj, { t: 'rReloj' })}>
            <HiddenId id={m.id} />
            <Boton tono="neutro">↻ Reset al total</Boton>
          </FormBtn>
        </div>

        {/* Ajustes rápidos ±30/±10/±5 segundos */}
        <div className="rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ring-white/10 p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-tenue">Ajuste rápido</p>
          <div className="grid grid-cols-3 gap-2">
            {[-30, -10, -5, 5, 10, 30].map((d) => (
              <FormBtn key={d} action={ajustarCronometro}>
                <HiddenId id={m.id} />
                <input type="hidden" name="delta" value={d} />
                <Boton tono={d < 0 ? 'rojo' : 'primario'} ancho="full">
                  {d > 0 ? `+${d}s` : `${d}s`}
                </Boton>
              </FormBtn>
            ))}
          </div>
        </div>

        {/* Título editable + estilo (reuso FormEstilo) */}
        <div className="rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ring-white/10 p-4 space-y-4">
          <form action={renombrarEquipos} className="grid gap-3">
            <HiddenId id={m.id} />
            <input type="hidden" name="nombre_local" value={m.nombre_local} />
            <input type="hidden" name="nombre_visitante" value={m.nombre_visitante} />
            <div>
              <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">
                Título del cronómetro
              </label>
              <input
                name="titulo"
                defaultValue={m.titulo ?? ''}
                placeholder="Ej. Calentamiento, Descanso"
                maxLength={200}
                className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
              />
            </div>
            <Boton tono="primario">Guardar</Boton>
          </form>
          <FormEstilo m={m} />
        </div>
      </div>
    );
  }

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
                <FormBtn action={fast(resetReloj, { t: 'rReloj' })}>
                  <HiddenId id={m.id} />
                  <Boton tono="neutro">↻ Reset reloj</Boton>
                </FormBtn>
              </div>
            </div>
          )}

          {/* Play + Periodo. Play solo si hay algún cronómetro. */}
          <div className="flex flex-col items-center gap-3">
            {(conReloj || conShot) && (
              <FormBtn action={fast(togglePlay, () => ({ t: 'play', nowMs: Date.now() }))}>
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
            {conPeriodo && (
              <div className="flex items-center gap-2">
                <FormBtn action={fast(cambiarPeriodo, { t: 'per', d: -1 })}>
                  <HiddenId id={m.id} />
                  <input type="hidden" name="delta" value={-1} />
                  <Boton tono="neutro">−Q</Boton>
                </FormBtn>
                <span className="font-orbitron font-bold text-2xl text-orange-300 min-w-[3.5rem] text-center">
                  {periodoEtiqueta}
                </span>
                <FormBtn action={fast(cambiarPeriodo, { t: 'per', d: 1 })}>
                  <HiddenId id={m.id} />
                  <input type="hidden" name="delta" value={1} />
                  <Boton tono="neutro">+Q</Boton>
                </FormBtn>
              </div>
            )}
            {/* Bocina manual: incrementa bocina_pulsos; el visor lo escucha
                por Realtime y suena la chicharra. El broadcast la dispara
                ~250 ms antes que postgres_changes. */}
            <FormBtn action={fast(sonarBocina, { t: 'bocina' })}>
              <HiddenId id={m.id} />
              <Boton tono="primario">🔔 Bocina</Boton>
            </FormBtn>
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
                <FormBtn action={fast(resetShot, () => ({ t: 'rShot', seg: 24, nowMs: Date.now() }))}>
                  <HiddenId id={m.id} />
                  <input type="hidden" name="segundos" value={24} />
                  <Boton tono="primario">↻ 24</Boton>
                </FormBtn>
                <FormBtn action={fast(resetShot, () => ({ t: 'rShot', seg: 14, nowMs: Date.now() }))}>
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
        <BloqueEquipo m={m} equipo="local" fast={fast} />
        <BloqueEquipo m={m} equipo="visitante" fast={fast} />
      </div>

      {/* Configuración: renombrar + reinicio */}
      <div className="rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ring-white/10 p-4 sm:p-5 space-y-4">
        <form action={renombrarEquipos} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <HiddenId id={m.id} />
          <div className="sm:col-span-3">
            <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">
              Título del marcador <span className="normal-case text-tenue/70">(opcional — evento/torneo)</span>
            </label>
            <input
              name="titulo"
              defaultValue={m.titulo ?? ''}
              placeholder="Ej. Copa CMT 2026 — Final"
              maxLength={200}
              className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">Nombre LOCAL</label>
            <div className="flex items-stretch gap-2">
              <input
                name="nombre_local"
                defaultValue={m.nombre_local}
                className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
              />
              <input
                name="color_local"
                type="color"
                defaultValue={m.color_local ?? '#ffffff'}
                title="Color del texto del nombre LOCAL"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-borde bg-campo p-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-tenue mb-1 uppercase tracking-widest">Nombre VISITANTE</label>
            <div className="flex items-stretch gap-2">
              <input
                name="nombre_visitante"
                defaultValue={m.nombre_visitante}
                className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-full"
              />
              <input
                name="color_visitante"
                type="color"
                defaultValue={m.color_visitante ?? '#ffffff'}
                title="Color del texto del nombre VISITANTE"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-borde bg-campo p-1"
              />
            </div>
          </div>
          <Boton tono="primario">Guardar</Boton>
        </form>

        {/* Estilo del marcador (SQL 31) — fuente, color de puntos por equipo y fondo. */}
        <FormEstilo m={m} />

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
