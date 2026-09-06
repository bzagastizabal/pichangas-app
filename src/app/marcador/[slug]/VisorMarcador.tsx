// src/app/marcador/[slug]/VisorMarcador.tsx
// Pantalla pública del marcador (proyección). Diseño broadcast: tipografía
// LED (Orbitron) con glow, insignia CMT como watermark, cards de equipo con
// gradiente, BONUS y último minuto en rojo pulsante, shot < 5s en rojo,
// flash al cambiar el puntaje. Responsivo de móvil a 4K.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { formatearReloj, msRestantes, type Marcador } from '@/lib/types';
import {
  configAvisos,
  numeroEnPalabras,
  textoAviso,
} from '@/lib/cronometro-avisos';
import { AvisosCronometro } from '@/components/AvisosCronometro';
import { useMantenerPantalla } from '@/lib/wake-lock';
import { BotonPantalla } from '@/components/BotonPantalla';
import {
  ajustarCronometro,
  fijarTotalCronometro,
  resetReloj,
  sonarBocina,
  togglePlay,
} from '@/app/admin/marcadores/[id]/control/actions';
import {
  anunciarVoz,
  audioDesbloqueado,
  cargarPaqueteVoz,
  desbloquearAudio,
  listarVocesEs,
  nombreVozActiva,
  reproducirClip,
  setVozPreferida,
  suscribirVoces,
  tocarBeep,
  tocarBocina,
} from '@/lib/audio-marcador';
import { BUCKET_VOCES, claveCuenta, claveHito } from '@/lib/voces';
import { urlPublica } from '@/lib/storage';
import {
  aplicarEventoFast,
  canalFast,
  type EventoFast,
} from '@/lib/marcador-broadcast';

// ---- Lado de un equipo ---------------------------------------------------

type Lado = 'local' | 'visitante';

const ACENTO: Record<Lado, { punto: string; glow: string; chip: string }> = {
  local: {
    punto: 'bg-orange-500 shadow-[0_0_18px_rgba(251,146,60,0.85)]',
    glow:  '0 0 60px rgba(251,146,60,0.45), 0 0 120px rgba(251,146,60,0.18)',
    chip:  'bg-orange-500/20 ring-orange-400/40 text-orange-200',
  },
  visitante: {
    punto: 'bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.85)]',
    glow:  '0 0 60px rgba(56,189,248,0.45), 0 0 120px rgba(56,189,248,0.18)',
    chip:  'bg-sky-500/20 ring-sky-400/40 text-sky-200',
  },
};

// Hook que devuelve true durante `duracionMs` luego de cambiar `valor`.
function useFlashAlCambiar<T>(valor: T, duracionMs = 700): boolean {
  const previo = useRef(valor);
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    if (previo.current !== valor) {
      setActivo(true);
      const t = setTimeout(() => setActivo(false), duracionMs);
      previo.current = valor;
      return () => clearTimeout(t);
    }
  }, [valor, duracionMs]);
  return activo;
}

// Selector de voz: dropdown flotante para elegir voz de Web Speech. Se
// muestra sólo en modo cronómetro y sólo cuando hay voces disponibles.
// Al cambiar, hace un preview de "Hola" con la voz nueva y persiste la
// elección en localStorage.
function SelectorVoz() {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [activa, setActiva] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setVoces(listarVocesEs());
      setActiva(nombreVozActiva());
    };
    refresh();
    const unsub = suscribirVoces(refresh);
    return unsub;
  }, []);

  if (!voces.length) return null;

  function elegir(nombre: string) {
    setVozPreferida(nombre);
    setActiva(nombre);
    setAbierto(false);
    anunciarVoz('Uno dos tres', { volumen: 0.8, rate: 1.1 });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/15 text-zinc-300 px-3 h-9 text-xs hover:bg-white/10"
        title="Cambiar voz del cronómetro"
      >
        <span>🎙️</span>
        <span className="max-w-[10rem] truncate">{activa ?? 'Voz auto'}</span>
      </button>
      {abierto && (
        <div className="absolute right-0 top-11 z-30 w-64 max-h-80 overflow-y-auto rounded-lg bg-zinc-900 ring-1 ring-white/15 shadow-xl p-1">
          {voces.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => elegir(v.name)}
              className={`w-full text-left px-3 py-1.5 text-xs rounded transition ${
                activa === v.name
                  ? 'bg-orange-500/25 text-orange-100'
                  : 'text-zinc-200 hover:bg-white/5'
              }`}
            >
              <div className="font-medium truncate">{v.name}</div>
              <div className="text-tenue text-[0.65rem]">{v.lang}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Wrapper de acción: emite el evento predicho por el canal fast ANTES de
// llamar al Server Action y lo aplica al estado local, igual que el panel de
// control. Así el proyector (otro dispositivo) se entera en ~30-80 ms.
type Accion = (fd: FormData) => void | Promise<void>;
type FastFn = <A extends Accion>(accion: A, evOrFn: EventoFast | (() => EventoFast)) => A;

// Fábricas de eventos fast: Date.now() se sella al hacer click, no al pintar.
const evPlay = (): EventoFast => ({ t: 'play', nowMs: Date.now() });
const evAjuste = (d: number): EventoFast => ({ t: 'ajuste', d, nowMs: Date.now() });

// ---- Dock de control del cronómetro (misma vista) ------------------------
// Se renderiza sobre el reloj gigante solo para administradores: permite
// operar el cronómetro desde el móvil sin abrir /admin/marcadores/.../control.

function DockCronometro({
  m,
  fast,
  abierto,
  onCerrar,
}: {
  m: Marcador;
  fast: FastFn;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [panel, setPanel] = useState<'ninguno' | 'avisos' | 'total'>('ninguno');
  const totalSeg = m.duracion_periodo_seg;

  if (!abierto) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Panel desplegable (avisos / total) */}
      {panel !== 'ninguno' && (
        <div className="w-full max-w-2xl max-h-[52vh] overflow-y-auto rounded-2xl bg-zinc-950/95 backdrop-blur ring-1 ring-white/15 p-4 shadow-2xl">
          {panel === 'avisos' && <AvisosCronometro m={m} />}
          {panel === 'total' && (
            <form action={fijarTotalCronometro} className="space-y-3">
              <input type="hidden" name="id" value={m.id} />
              <p className="text-xs uppercase tracking-widest text-tenue">
                Tiempo total (actual: {Math.floor(totalSeg / 60)}:
                {String(totalSeg % 60).padStart(2, '0')})
              </p>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-[0.7rem] text-tenue mb-1">Minutos</label>
                  <input
                    name="crono_min"
                    type="number"
                    min={0}
                    max={240}
                    defaultValue={Math.floor(totalSeg / 60)}
                    className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-24"
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] text-tenue mb-1">Segundos</label>
                  <input
                    name="crono_seg"
                    type="number"
                    min={0}
                    max={59}
                    defaultValue={totalSeg % 60}
                    className="border border-borde rounded-lg px-3 py-2 bg-campo text-texto w-24"
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold active:scale-[0.97] transition"
                >
                  Aplicar
                </button>
              </div>
              <p className="text-[0.7rem] text-tenue">
                Deja el reloj en el nuevo total, pausado.
              </p>
            </form>
          )}
        </div>
      )}

      {/* Barra principal: ajustes ± y play/pausa */}
      <div className="w-full max-w-2xl rounded-2xl bg-black/70 backdrop-blur ring-1 ring-white/15 p-2 shadow-2xl">
        <div className="flex items-center justify-center gap-2">
          {[-30, -10].map((d) => (
            <form
              key={d}
              action={fast(ajustarCronometro, () => evAjuste(d))}
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="delta" value={d} />
              <BotonDock tono="rojo">{d}s</BotonDock>
            </form>
          ))}

          <form action={fast(togglePlay, evPlay)}>
            <input type="hidden" name="id" value={m.id} />
            <button
              type="submit"
              aria-label={m.reloj_corriendo ? 'Pausar' : 'Iniciar'}
              className={`inline-flex h-16 w-16 items-center justify-center rounded-full text-white ring-2 ring-white/25 shadow-lg transition active:scale-[0.95] ${
                m.reloj_corriendo ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {m.reloj_corriendo ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              )}
            </button>
          </form>

          {[10, 30].map((d) => (
            <form
              key={d}
              action={fast(ajustarCronometro, () => evAjuste(d))}
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="delta" value={d} />
              <BotonDock tono="verde">+{d}s</BotonDock>
            </form>
          ))}
        </div>

        {/* Fila secundaria: reset, bocina, paneles, ocultar */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <form action={fast(resetReloj, { t: 'rReloj' })}>
            <input type="hidden" name="id" value={m.id} />
            <BotonDock tono="neutro" pequeno>↻ Reset</BotonDock>
          </form>
          <form action={fast(sonarBocina, { t: 'bocina' })}>
            <input type="hidden" name="id" value={m.id} />
            <BotonDock tono="neutro" pequeno>📣 Bocina</BotonDock>
          </form>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'avisos' ? 'ninguno' : 'avisos'))}
            className={`h-10 px-3 rounded-xl text-xs font-bold ring-1 transition active:scale-[0.97] ${
              panel === 'avisos'
                ? 'bg-orange-600/40 ring-orange-400/60 text-orange-100'
                : 'bg-zinc-800/80 ring-white/10 text-zinc-100 hover:bg-zinc-700/80'
            }`}
          >
            🔔 Avisos
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'total' ? 'ninguno' : 'total'))}
            className={`h-10 px-3 rounded-xl text-xs font-bold ring-1 transition active:scale-[0.97] ${
              panel === 'total'
                ? 'bg-orange-600/40 ring-orange-400/60 text-orange-100'
                : 'bg-zinc-800/80 ring-white/10 text-zinc-100 hover:bg-zinc-700/80'
            }`}
          >
            ⏱ Total
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="h-10 px-3 rounded-xl text-xs font-bold bg-zinc-800/80 ring-1 ring-white/10 text-zinc-300 hover:bg-zinc-700/80 active:scale-[0.97] transition"
          >
            ✕ Ocultar
          </button>
        </div>
      </div>
    </div>
  );
}

function BotonDock({
  children,
  tono = 'neutro',
  pequeno = false,
}: {
  children: React.ReactNode;
  tono?: 'neutro' | 'verde' | 'rojo';
  pequeno?: boolean;
}) {
  const tonos = {
    neutro: 'bg-zinc-800/80 ring-white/10 text-zinc-100 hover:bg-zinc-700/80',
    verde:  'bg-green-600 ring-green-400/40 text-white hover:bg-green-500',
    rojo:   'bg-red-600 ring-red-400/40 text-white hover:bg-red-500',
  }[tono];
  const tam = pequeno ? 'h-10 px-3 text-xs' : 'h-14 px-4 text-base';
  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-xl font-bold ring-1 transition active:scale-[0.97] ${tonos} ${tam}`}
    >
      {children}
    </button>
  );
}

// Sync con SQL 31 + globals.css. Devuelve la clase Tailwind para la fuente.
const FUENTE_CLS: Record<string, string> = {
  orbitron:   'font-orbitron',
  bebas:      'font-bebas',
  anton:      'font-anton',
  iceland:    'font-iceland',
  rubik_mono: 'font-rubik-mono',
  led:        'font-led',
};

// Ratio empírico ancho-glifo / font-size en 'font-black' + tabular-nums (medido
// en 4K). Orbitron y Rubik Mono son casi cuadradas; Bebas/Anton condensed; Iceland
// medio; LED (DSEG7 Classic Bold) es cuadrada tipo scoreboard.
const RATIO_GLIFO: Record<string, number> = {
  orbitron:   0.57,
  bebas:      0.36,
  anton:      0.48,
  iceland:    0.50,
  rubik_mono: 0.80,
  led:        0.62,
};

function PanelEquipo({
  nombre,
  puntos,
  faltas,
  timeouts,
  lado,
  mega = false,
  colorNombre,
  colorPuntos,
  fuente = 'orbitron',
  neon = false,
  digitosGlobal,
}: {
  nombre: string;
  puntos: number;
  faltas: number;
  timeouts: number;
  lado: Lado;
  // mega = sin reloj, sin shot y sin Q → nombre y puntaje al máximo.
  mega?: boolean;
  // Color HEX del texto del nombre (configurable desde el control).
  colorNombre?: string | null;
  colorPuntos?: string | null;
  fuente?: string;
  // Halo brillante (para proyectores oscuros).
  neon?: boolean;
  // Máximo de dígitos entre los dos equipos — ambos usan el mismo font-size
  // para que 9 vs 12 no queden desproporcionados.
  digitosGlobal?: number;
}) {
  const bonus = faltas >= 4;
  const flash = useFlashAlCambiar(puntos);
  const acento = ACENTO[lado];

  // En mega escalamos según la cantidad de dígitos del puntaje para que dos
  // o tres dígitos no se desborden del panel (cada panel = 50vw en landscape).
  // Para nombre y puntaje usamos min(vh, vw) — vh limita la altura disponible
  // y vw limita el ancho del panel para no chocar con el panel de al lado.
  // Usamos el max de dígitos entre ambos equipos si el parent nos lo pasa
  // (para uniformar el tamaño 9 vs 12); si no, caemos al conteo local.
  const digitos = Math.max(
    1,
    digitosGlobal ?? String(Math.max(0, puntos)).length,
  );
  const ratio = RATIO_GLIFO[fuente] ?? RATIO_GLIFO.orbitron;
  // Panel útil ≈ 49vw. Apuntamos a que el número ocupe ~80% del panel
  // (deja ~10% de margen a cada lado para que 87 - 74 no se toquen en el
  // centro). vwFont * digitos * ratio ≈ 38vw → vwFont = 38 / (digitos*ratio).
  // Cap alto por si es 1 dígito (evita gigantismo desproporcionado).
  const vwPunto = Math.min(55, Math.floor(38 / (digitos * ratio)));
  const HEX = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
  const colorTxt = colorNombre && HEX.test(colorNombre) ? colorNombre : '#ffffff';
  const colorPts = colorPuntos && HEX.test(colorPuntos) ? colorPuntos : '#ffffff';
  const fuenteCls = FUENTE_CLS[fuente] ?? FUENTE_CLS.orbitron;

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-white/[0.035] to-white/[0.005] ring-1 ring-white/10 backdrop-blur-sm"
      style={{
        // En mega usamos casi nada de padding para liberar espacio al puntaje.
        padding: mega ? 'clamp(0.15rem, 0.4vmin, 0.6rem)' : 'clamp(0.75rem, 2vmin, 3rem)',
      }}
    >
      {/* Nombre. En mega ocultamos el punto de color para centrar el texto
          exactamente en el panel (el punto+gap lo desplazaba a la derecha).
          El color del texto ya identifica al equipo. */}
      <div className={`flex items-center max-w-full ${mega ? '' : 'gap-[1.2vmin]'}`}>
        {!mega && (
          <span
            className={`rounded-full ${acento.punto}`}
            style={{ width: 'clamp(0.6rem, 1.4vmin, 1.5rem)', height: 'clamp(0.6rem, 1.4vmin, 1.5rem)' }}
            aria-hidden
          />
        )}
        <p
          className="uppercase tracking-[0.18em] font-bold truncate text-center"
          style={{
            color: colorTxt,
            // Mega: llenamos el espacio superior desperdiciado con nombres
            // grandes. min(vh,vw) protege contra desborde horizontal en
            // landscape donde el panel mide ~50vw.
            fontSize: mega
              ? 'clamp(2.2rem, min(17vh, 6.5vw), 22rem)'
              : 'clamp(1.1rem, 5vmin, 7rem)',
          }}
        >
          {nombre}
        </p>
      </div>

      {/* Puntaje gigante. En mega escalamos por dígitos y limitamos por vw
          para que no se choquen los dos paneles. vh marca el alto, vw el
          ancho disponible en cada panel (~50vw en 2 columnas). */}
      <p
        // w-full + text-center: sin esto el <p> se encoge al ancho del contenido
        // y el items-center del panel lo alinea por su borde derecho cuando
        // "7" (1 dig) y "87" (2 dig) tienen anchos distintos — el score de 1
        // dig quedaba corrido a la derecha respecto del eje del panel.
        className={`w-full text-center ${fuenteCls} font-black tabular-nums leading-none ${flash ? 'animate-flash-score' : ''}`}
        style={{
          // En mega crecemos al máximo: min(92vh, vwPunto*vw). vwPunto se
          // calcula por dígitos × ratio del glifo de la fuente elegida.
          // Score cap 88vh en mega para dejar aire entre nombre y numero
          // (antes 92vh, pero la fuente LED extiende segmentos hasta el
          // limite superior del line-box y se pega al nombre).
          fontSize: mega
            ? `clamp(8rem, min(88vh, ${vwPunto}vw), 140rem)`
            : 'clamp(5rem, 32vmin, 40rem)',
          marginTop: mega
            ? 'clamp(1rem, 3vmin, 4rem)'
            : 'clamp(0.5rem, 1.5vmin, 2rem)',
          color: colorPts,
          // Con neón: doble halo en el mismo color del puntaje (potente).
          // Sin neón: halo suave del acento por lado (orange/sky).
          textShadow: neon
            ? `0 0 12px ${colorPts}, 0 0 40px ${colorPts}, 0 0 90px ${colorPts}, 0 0 180px ${colorPts}`
            : acento.glow,
          letterSpacing: '-0.02em',
        }}
      >
        {puntos}
      </p>

      {/* Faltas + Timeouts — en mega se ocultan para liberar todo el alto al puntaje. */}
      {!mega && (
      <div
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        style={{ marginTop: 'clamp(0.5rem, 1.5vmin, 2rem)' }}
      >
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 ring-1 backdrop-blur ${
            bonus
              ? 'bg-red-500/20 ring-red-400/60 text-red-100 animate-pulse'
              : 'bg-white/5 ring-white/15 text-zinc-200'
          }`}
        >
          <span className="text-[0.65rem] sm:text-xs uppercase tracking-widest opacity-70">
            Faltas
          </span>
          <span className="font-mono font-bold text-base sm:text-lg">{faltas}</span>
          {bonus && (
            <span className="text-[0.65rem] sm:text-xs font-extrabold ml-1 px-1.5 py-0.5 rounded bg-red-500 text-white">
              BONUS
            </span>
          )}
        </span>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 ring-1 ${acento.chip}`}>
          <span className="text-[0.65rem] sm:text-xs uppercase tracking-widest opacity-70">
            Timeouts
          </span>
          <span className="font-mono font-bold text-base sm:text-lg">{timeouts}</span>
        </span>
      </div>
      )}
    </div>
  );
}

// ---- Shot clock central --------------------------------------------------

function ShotClock({ ms, fuenteCls = 'font-orbitron' }: { ms: number; fuenteCls?: string }) {
  const segundos = Math.max(0, Math.ceil(ms / 1000));
  const peligro = ms < 5000;
  return (
    <div
      className="flex flex-col items-center justify-center self-center"
      style={{ padding: 'clamp(0.5rem, 1.5vmin, 1.5rem)' }}
    >
      <p
        className="text-zinc-500 uppercase tracking-[0.4em]"
        style={{
          fontSize: 'clamp(0.55rem, 1.1vmin, 1rem)',
          marginBottom: 'clamp(0.25rem, 0.6vmin, 0.6rem)',
        }}
      >
        Shot
      </p>
      <div
        className={`${fuenteCls} font-black tabular-nums leading-none ${peligro ? 'animate-glow-soft' : ''}`}
        style={{
          fontSize: 'clamp(2.75rem, 14vmin, 20rem)',
          color: peligro ? '#ef4444' : '#fbbf24',
          textShadow: peligro
            ? '0 0 30px rgba(239,68,68,0.85), 0 0 70px rgba(239,68,68,0.45)'
            : '0 0 24px rgba(251,191,36,0.55), 0 0 60px rgba(251,191,36,0.25)',
        }}
      >
        {segundos}
      </div>
    </div>
  );
}

// ---- Visor principal -----------------------------------------------------

export function VisorMarcador({
  inicial,
  puedeControlar = false,
}: {
  inicial: Marcador;
  // true solo para administradores: habilita el dock de control en la misma
  // pantalla (operar el cronómetro desde el móvil sin abrir /admin).
  puedeControlar?: boolean;
}) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const [sonidoOn, setSonidoOn] = useState(false);
  const [dockAbierto, setDockAbierto] = useState(puedeControlar);
  // Wake Lock encendido por defecto: el visor casi siempre está proyectando.
  const [pantallaOn, setPantallaOn] = useState(true);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fastRef = useRef<RealtimeChannel | null>(null);
  // Refs para detectar transiciones de segundo sin re-disparar el RAF.
  const lastShotSecRef = useRef<number>(Math.ceil(inicial.shot_restante_ms / 1000));
  const lastRelojPosRef = useRef<boolean>(inicial.reloj_restante_ms > 0);
  const lastBocinaRef = useRef<number>(inicial.bocina_pulsos ?? 0);
  // Cronómetro: último segundo mostrado. Los avisos se disparan SOLO al
  // cruzar hacia abajo (seg < anterior), así un +30s o un reset no los
  // dispara y cada hito puede volver a sonar si el reloj vuelve a subir.
  const lastSegRef = useRef<number>(Math.ceil(inicial.reloj_restante_ms / 1000));
  // Para disparar el clip "inicio" al pasar de pausa a marcha.
  const corriendoAntesRef = useRef<boolean>(inicial.reloj_corriendo);

  const { estado: estadoPantalla, reintentar: reintentarPantalla } =
    useMantenerPantalla(pantallaOn);

  async function alternarSonido() {
    if (sonidoOn) {
      setSonidoOn(false);
      return;
    }
    const ok = await desbloquearAudio();
    // Warm-up de SpeechSynthesis dentro del gesture del usuario. Sin esto,
    // algunos navegadores (iOS Safari) bloquean el primer speak posterior.
    if (ok && m.es_cronometro && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      anunciarVoz('Cronómetro listo', { volumen: 0.6, rate: 1.05 });
    }
    setSonidoOn(ok);
  }

  // Realtime: refleja cambios externos del control.
  // - postgres_changes: fuente de verdad (~200-400 ms desde click → visor).
  // - broadcast: fast-lane efímera que llega antes (~30-80 ms) y se aplica
  //   optimistamente; postgres_changes reconcilia al llegar.
  useEffect(() => {
    const supabase = createClient();
    const chDb = supabase
      .channel(`marcador:public:${inicial.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marcadores', filter: `id=eq.${inicial.id}` },
        (payload) => setM(payload.new as Marcador),
      )
      .subscribe();
    // Mismo canal para recibir (proyector) y emitir (dock del admin). Los
    // broadcast de Supabase no vuelven al emisor: el dock aplica su propio
    // evento en local.
    const chFast = supabase
      .channel(canalFast(inicial.id))
      .on('broadcast', { event: 'ev' }, ({ payload }) => {
        setM((prev) => aplicarEventoFast(prev, payload as EventoFast));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fastRef.current = chFast;
      });
    return () => {
      fastRef.current = null;
      supabase.removeChannel(chDb);
      supabase.removeChannel(chFast);
    };
  }, [inicial.id]);

  // Pack de voz (SQL 37): baja y decodifica los clips cuando cambia el pack.
  // Sin pack, limpia la caché para volver a la voz sintetizada.
  useEffect(() => {
    const id = m.voz_paquete_id ?? null;
    if (!id) {
      void cargarPaqueteVoz(null, {});
      return;
    }
    let cancelado = false;
    createClient()
      .from('voces_clips')
      .select('clave, path')
      .eq('paquete_id', id)
      .then(({ data }) => {
        if (cancelado || !data) return;
        const urls: Record<string, string> = {};
        for (const c of data as Array<{ clave: string; path: string }>) {
          urls[c.clave] = urlPublica(BUCKET_VOCES, c.path);
        }
        void cargarPaqueteVoz(id, urls);
      });
    return () => {
      cancelado = true;
    };
  }, [m.voz_paquete_id]);

  // Clip "inicio": al pasar de pausa a marcha.
  useEffect(() => {
    if (m.reloj_corriendo && !corriendoAntesRef.current && sonidoOn) {
      reproducirClip('inicio');
    }
    corriendoAntesRef.current = m.reloj_corriendo;
  }, [m.reloj_corriendo, sonidoOn]);

  // Emite el evento predicho al canal fast y lo aplica en local antes de que
  // vuelva el Server Action (mismo patrón que el panel de control).
  const fast: FastFn = (accion, evOrFn) => {
    return ((fd: FormData) => {
      const ev = typeof evOrFn === 'function' ? evOrFn() : evOrFn;
      setM((prev) => aplicarEventoFast(prev, ev));
      fastRef.current?.send({ type: 'broadcast', event: 'ev', payload: ev });
      return accion(fd);
    }) as typeof accion;
  };

  // Tick local con requestAnimationFrame para reloj y shot. También dispara
  // sonidos automáticos: beep cada segundo del shot del 5 al 1, chicharra
  // corta al expirar el shot, chicharra larga al expirar el reloj.
  useEffect(() => {
    const cfg = configAvisos(m);
    function tick() {
      const nuevoReloj = msRestantes(
        m.reloj_restante_ms,
        m.reloj_corriendo,
        m.reloj_inicio,
      );
      const nuevoShot = msRestantes(
        m.shot_restante_ms,
        m.shot_corriendo,
        m.shot_inicio,
      );
      setRelojMs(nuevoReloj);
      setShotMs(nuevoShot);

      // Beep en cada cruce de segundo del shot (5,4,3,2,1) + bocina corta a 0.
      if (sonidoOn && m.shot_corriendo) {
        const shotSec = Math.ceil(nuevoShot / 1000);
        if (shotSec < lastShotSecRef.current) {
          if (shotSec >= 1 && shotSec <= 5) tocarBeep();
          else if (shotSec === 0) tocarBocina(true, m.bocina_tipo);
          lastShotSecRef.current = shotSec;
        } else if (shotSec > lastShotSecRef.current) {
          // Reset (admin pulsó "24" o "14") — solo reseteamos el ref, no suena.
          lastShotSecRef.current = shotSec;
        }
      } else {
        lastShotSecRef.current = Math.ceil(nuevoShot / 1000);
      }

      // Cronómetro: avisos configurables (SQL 36) por cruce de segundo.
      //   - hitos de voz (3 min, 1 min, 30 s...) repetidos N veces
      //   - beep por segundo desde `beepDesde` hasta 1 (últimos 5 más agudos)
      //   - cuenta hablada opcional de los últimos N segundos
      if (m.es_cronometro) {
        const seg = Math.ceil(nuevoReloj / 1000);
        if (seg < lastSegRef.current && sonidoOn && m.reloj_corriendo) {
          // Con pack de voz suena el clip; si falta ese audio, voz del sistema.
          if (cfg.avisos.includes(seg)) {
            if (!reproducirClip(claveHito(seg), { veces: cfg.repetir })) {
              anunciarVoz(textoAviso(seg), { veces: cfg.repetir });
            }
          } else if (seg >= 1 && seg <= cfg.cuentaVozDesde) {
            if (!reproducirClip(claveCuenta(seg))) anunciarVoz(numeroEnPalabras(seg));
          }
          if (seg >= 1 && seg <= cfg.beepDesde) {
            tocarBeep(seg <= 5 ? 0.35 : 0.25, seg <= 5 ? 1400 : 1000);
          }
        }
        lastSegRef.current = seg;
      }

      // Bocina larga al expirar el reloj de juego (solo si estaba corriendo).
      const positivo = nuevoReloj > 0;
      if (
        sonidoOn &&
        m.reloj_corriendo &&
        lastRelojPosRef.current &&
        !positivo
      ) {
        // El clip "fin" del pack reemplaza la bocina cuando existe.
        if (!reproducirClip('fin')) tocarBocina(false, m.bocina_tipo);
      }
      lastRelojPosRef.current = positivo;

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [m, sonidoOn]);

  // Bocina remota: el admin incrementa bocina_pulsos desde el control.
  useEffect(() => {
    const actual = m.bocina_pulsos ?? 0;
    if (actual > lastBocinaRef.current && sonidoOn && audioDesbloqueado()) {
      tocarBocina(false, m.bocina_tipo);
    }
    lastBocinaRef.current = actual;
  }, [m.bocina_pulsos, sonidoOn]);

  function pantallaCompleta() {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const relojBajo = relojMs < 60_000 && m.reloj_corriendo;
  const periodoEtiqueta =
    m.periodo <= 4 ? `Q${m.periodo}` : `OT${m.periodo - 4}`;
  // Fallback a true para marcadores creados antes de SQL 22 (flags todavía nulos).
  const conReloj: boolean = m.tiene_reloj_periodo ?? true;
  const conShot: boolean = m.tiene_shot_clock ?? true;
  const conPeriodo: boolean = m.tiene_periodo ?? true;
  // Modo "máximo simple": sin reloj, sin shot y sin Q → nombres y puntajes
  // crecen para ocupar el espacio liberado.
  const modoMega = !conReloj && !conShot && !conPeriodo;
  // Máximo de dígitos entre ambos equipos — para que 9 vs 12 no queden con
  // tamaños distintos, ambos paneles usan el mismo conteo.
  const digitosMax = Math.max(
    String(Math.max(0, m.puntos_local)).length,
    String(Math.max(0, m.puntos_visitante)).length,
    1,
  );

  // Estilo configurable (SQL 31). Fallbacks para marcadores previos.
  const fuenteM = (m.fuente as string) ?? 'orbitron';
  const fuenteClsM = FUENTE_CLS[fuenteM] ?? FUENTE_CLS.orbitron;
  const HEX = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
  const colorFondoM = m.color_fondo && HEX.test(m.color_fondo) ? m.color_fondo : '#000000';
  const colorPtsGlobal = m.color_puntos_local && HEX.test(m.color_puntos_local)
    ? m.color_puntos_local : '#ffffff';

  // Modo cronómetro: layout completamente distinto (solo reloj gigante).
  if (m.es_cronometro) {
    // El dock abierto ocupa la franja inferior: el reloj se achica para no
    // quedar tapado (en proyección el dock va cerrado y ocupa todo).
    const dockConEspacio = puedeControlar && dockAbierto;
    // formato MM:SS o M:SS.MMM cuando queda poco (últimos 10s: mostramos décimas).
    const bajos = relojMs < 10_000;
    const totalSeg = Math.max(0, Math.ceil(relojMs / 1000));
    const mm = Math.floor(totalSeg / 60);
    const ss = totalSeg % 60;
    const decs = Math.max(0, Math.floor((relojMs % 1000) / 100));
    const textoReloj = bajos
      ? `${Math.floor(relojMs / 1000)}.${decs}`
      : `${mm}:${ss.toString().padStart(2, '0')}`;
    return (
      <div
        ref={rootRef}
        onDoubleClick={pantallaCompleta}
        className="relative min-h-[100dvh] w-full overflow-hidden text-white select-none"
        style={{
          backgroundColor: colorFondoM,
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(255,255,255,0.06), transparent 70%),' +
            'radial-gradient(ellipse at bottom, rgba(0,0,0,0.35), transparent 70%)',
        }}
      >
        {/* Botones flotantes */}
        <div className="absolute right-3 top-3 z-40 flex items-center gap-2 opacity-40 hover:opacity-100 focus-within:opacity-100 transition">
          {puedeControlar && (
            <button
              type="button"
              onClick={() => setDockAbierto((v) => !v)}
              aria-label={dockAbierto ? 'Ocultar controles' : 'Mostrar controles'}
              className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 transition ${
                dockAbierto
                  ? 'bg-orange-600/30 ring-orange-400/50 text-orange-100'
                  : 'bg-white/5 ring-white/15 text-zinc-300'
              }`}
              title="Controlar el cronómetro desde esta pantalla"
            >
              🎛 <span className="hidden sm:inline">Controles</span>
            </button>
          )}
          {sonidoOn && <SelectorVoz />}
          <BotonPantalla
            estado={estadoPantalla}
            activo={pantallaOn}
            onToggle={() => setPantallaOn((v) => !v)}
            onReintentar={reintentarPantalla}
          />
          <button
            type="button"
            onClick={alternarSonido}
            aria-label={sonidoOn ? 'Silenciar sonido' : 'Activar sonido'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
              sonidoOn
                ? 'bg-green-500/15 ring-green-400/40 text-green-300'
                : 'bg-white/5 ring-white/15 text-zinc-400'
            }`}
            title={sonidoOn ? 'Silenciar' : 'Activar sonido / voz'}
          >
            <span className="text-base">{sonidoOn ? '🔊' : '🔇'}</span>
          </button>
          <button
            type="button"
            onClick={pantallaCompleta}
            aria-label="Pantalla completa"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 text-zinc-300"
            title="Pantalla completa"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div
          className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center transition-[padding] duration-200"
          style={{ paddingBottom: dockConEspacio ? 'clamp(9rem, 24vh, 15rem)' : undefined }}
        >
          {m.titulo && (
            <p
              className="uppercase tracking-[0.35em] font-semibold text-zinc-300 truncate mb-4"
              style={{ fontSize: 'clamp(1rem, 3vmin, 3.5rem)' }}
            >
              {m.titulo}
            </p>
          )}
          <p
            className={`${fuenteClsM} font-black tabular-nums leading-none w-full text-center ${
              bajos ? 'animate-glow-soft' : ''
            }`}
            style={{
              // Reloj gigante — se llena en vw pero limitado por vh. En cuenta
              // detallada (10s) el número es más corto: crece más grande.
              fontSize: bajos
                ? `clamp(6rem, min(${dockConEspacio ? 52 : 80}vh, 55vw), 140rem)`
                : `clamp(4rem, min(${dockConEspacio ? 45 : 70}vh, 32vw), 120rem)`,
              color: bajos ? '#ef4444' : colorPtsGlobal,
              textShadow: m.neon
                ? `0 0 12px ${bajos ? '#ef4444' : colorPtsGlobal}, 0 0 40px ${bajos ? '#ef4444' : colorPtsGlobal}, 0 0 90px ${bajos ? '#ef4444' : colorPtsGlobal}`
                : bajos
                  ? '0 0 40px rgba(239,68,68,0.85), 0 0 100px rgba(239,68,68,0.4)'
                  : '0 0 30px rgba(255,255,255,0.35), 0 0 90px rgba(255,255,255,0.12)',
              letterSpacing: '-0.02em',
            }}
          >
            {textoReloj}
          </p>
        </div>

        {/* Dock de control (solo admin) — misma vista, pensado para móvil. */}
        {puedeControlar && (
          <DockCronometro
            m={m}
            fast={fast}
            abierto={dockAbierto}
            onCerrar={() => setDockAbierto(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      onDoubleClick={pantallaCompleta}
      className="relative min-h-[100dvh] w-full overflow-hidden text-white select-none"
      style={{
        backgroundColor: colorFondoM,
        // Vignette sutil por encima del color de fondo — mantiene la sensación
        // "de estadio" sin apagar el color elegido por el admin.
        backgroundImage:
          'radial-gradient(ellipse at top, rgba(255,255,255,0.06), transparent 70%),' +
          'radial-gradient(ellipse at bottom, rgba(0,0,0,0.35), transparent 70%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Insignia CMT como watermark sutil al centro */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <Image
          src="/cmt_insignia.png"
          alt=""
          width={1500}
          height={1500}
          priority
          className="h-auto opacity-[0.04] mix-blend-screen"
          style={{ width: 'min(50vmin, 60vmax)' }}
        />
      </div>

      {/* Líneas de "cancha" decorativas */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />

      {/* Botones flotantes (siempre disponibles, también en mega): sonido + fullscreen. */}
      {modoMega && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 opacity-30 hover:opacity-100 transition">
          <BotonPantalla
            estado={estadoPantalla}
            activo={pantallaOn}
            onToggle={() => setPantallaOn((v) => !v)}
            onReintentar={reintentarPantalla}
          />
          <button
            type="button"
            onClick={alternarSonido}
            aria-label={sonidoOn ? 'Silenciar sonido' : 'Activar sonido'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
              sonidoOn
                ? 'bg-green-500/15 ring-green-400/40 text-green-300'
                : 'bg-white/5 ring-white/15 text-zinc-400'
            }`}
            title={sonidoOn ? 'Silenciar' : 'Activar sonido'}
          >
            <span className="text-base">{sonidoOn ? '🔊' : '🔇'}</span>
          </button>
          <button
            type="button"
            onClick={pantallaCompleta}
            aria-label="Pantalla completa"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 text-zinc-300"
            title="Pantalla completa"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Contenido encima */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {/* Título opcional (SQL 32) — evento/torneo. Se muestra siempre arriba
            cuando está seteado. En mega ocupa el header liberado. */}
        {m.titulo && (
          <div
            className="w-full text-center"
            style={{
              paddingTop:    modoMega ? 'clamp(0.5rem, 1.5vmin, 2rem)' : 'clamp(0.4rem, 1vmin, 1.5rem)',
              paddingBottom: modoMega ? 'clamp(0.25rem, 0.8vmin, 1rem)' : 'clamp(0.2rem, 0.6vmin, 0.8rem)',
              paddingLeft:   'clamp(0.75rem, 2vmin, 3rem)',
              paddingRight:  'clamp(0.75rem, 2vmin, 3rem)',
            }}
          >
            <p
              className="uppercase tracking-[0.35em] font-semibold text-zinc-300 truncate"
              style={{ fontSize: modoMega ? 'clamp(1rem, 3vmin, 3.5rem)' : 'clamp(0.7rem, 1.6vmin, 2rem)' }}
            >
              {m.titulo}
            </p>
          </div>
        )}
        {/* HEADER — se oculta en mega para liberar todo el alto al puntaje. */}
        {!modoMega && (
        <header
          className="flex items-center justify-between"
          style={{
            paddingLeft: 'clamp(0.75rem, 2vmin, 3rem)',
            paddingRight: 'clamp(0.75rem, 2vmin, 3rem)',
            paddingTop: 'clamp(0.5rem, 1.2vmin, 1.5rem)',
            paddingBottom: 'clamp(0.5rem, 1.2vmin, 1.5rem)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/cmt_insignia.png"
              alt="CMT BasketBall Club"
              width={88}
              height={88}
              priority
              className="drop-shadow-[0_0_18px_rgba(251,146,60,0.35)]"
              style={{
                height: 'clamp(2rem, 4.5vmin, 5rem)',
                width: 'clamp(2rem, 4.5vmin, 5rem)',
              }}
            />
            <div className="min-w-0 leading-tight">
              <p
                className="font-semibold uppercase tracking-[0.22em] text-zinc-200 truncate"
                style={{ fontSize: 'clamp(0.65rem, 1.4vmin, 1.4rem)' }}
              >
                CMT BasketBall Club
              </p>
              <p
                className="hidden xs:block sm:block text-zinc-500 tracking-widest uppercase truncate"
                style={{ fontSize: 'clamp(0.55rem, 1vmin, 1rem)' }}
              >
                Clorinda Matto de Turner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Estado LIVE / EN PAUSA */}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] sm:text-xs font-bold uppercase tracking-widest ring-1 ${
                m.reloj_corriendo
                  ? 'bg-red-500/15 ring-red-500/40 text-red-200'
                  : 'bg-white/5 ring-white/15 text-zinc-300'
              }`}
            >
              <span className="relative inline-flex h-2 w-2">
                {m.reloj_corriendo && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    m.reloj_corriendo ? 'bg-red-500' : 'bg-zinc-500'
                  }`}
                />
              </span>
              {m.reloj_corriendo ? 'LIVE' : 'PAUSA'}
            </span>

            <BotonPantalla
              estado={estadoPantalla}
              activo={pantallaOn}
              onToggle={() => setPantallaOn((v) => !v)}
              onReintentar={reintentarPantalla}
              tam="grande"
            />

            <button
              type="button"
              onClick={alternarSonido}
              aria-label={sonidoOn ? 'Silenciar sonido' : 'Activar sonido'}
              className={`inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full ring-1 transition ${
                sonidoOn
                  ? 'bg-green-500/15 ring-green-400/40 text-green-300 hover:bg-green-500/25'
                  : 'bg-white/5 ring-white/15 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
              title={sonidoOn ? 'Silenciar (sonido activado)' : 'Activar sonido del marcador'}
            >
              <span className="text-base sm:text-lg">{sonidoOn ? '🔊' : '🔇'}</span>
            </button>

            <button
              type="button"
              onClick={pantallaCompleta}
              aria-label="Pantalla completa"
              className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 text-zinc-300 hover:bg-white/10 hover:text-white transition"
              title="Pantalla completa (o doble click en cualquier parte)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:h-5 sm:w-5">
                <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>
        )}

        {/* HERO: Tiempo (con o sin Q label encima) o Q gigante o nada — depende
            de los flags. Cuando se ocultan los tres (reloj, shot, Q), el hero
            desaparece y los paneles de equipo se quedan con todo el espacio. */}
        {(conReloj || conPeriodo) && (
          <div
            className="flex flex-col items-center"
            style={{
              paddingLeft: 'clamp(0.5rem, 2vmin, 3rem)',
              paddingRight: 'clamp(0.5rem, 2vmin, 3rem)',
              paddingTop: 'clamp(0.25rem, 0.8vmin, 1rem)',
              paddingBottom: 'clamp(0.5rem, 1.2vmin, 1.5rem)',
            }}
          >
            {conReloj ? (
              <>
                {conPeriodo && (
                  <div
                    className="inline-flex items-baseline gap-3 uppercase tracking-[0.45em]"
                    style={{ fontSize: 'clamp(0.85rem, 2.2vmin, 2.5rem)' }}
                  >
                    <span className={`${fuenteClsM} font-black text-orange-400`}>
                      {periodoEtiqueta}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400 font-semibold">Periodo</span>
                  </div>
                )}
                <p
                  className={`${fuenteClsM} font-black tabular-nums leading-none ${
                    relojBajo ? 'animate-glow-soft' : ''
                  }`}
                  style={{
                    marginTop: 'clamp(0.15rem, 0.6vmin, 0.8rem)',
                    fontSize: 'clamp(3.5rem, 20vmin, 26rem)',
                    color: relojBajo ? '#ef4444' : '#ffffff',
                    textShadow: relojBajo
                      ? '0 0 40px rgba(239,68,68,0.85), 0 0 100px rgba(239,68,68,0.4)'
                      : '0 0 28px rgba(255,255,255,0.45), 0 0 80px rgba(255,255,255,0.15)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatearReloj(relojMs)}
                </p>
              </>
            ) : (
              // Sin reloj pero con periodo: Q gigante como hero.
              <>
                <p
                  className="uppercase tracking-[0.45em] text-zinc-400 font-semibold"
                  style={{ fontSize: 'clamp(0.85rem, 1.8vmin, 2rem)' }}
                >
                  Periodo
                </p>
                <p
                  className={`${fuenteClsM} font-black tabular-nums leading-none text-orange-400`}
                  style={{
                    marginTop: 'clamp(0.15rem, 0.6vmin, 0.8rem)',
                    fontSize: 'clamp(5rem, 30vmin, 38rem)',
                    textShadow: '0 0 40px rgba(251,146,60,0.55), 0 0 90px rgba(251,146,60,0.25)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {periodoEtiqueta}
                </p>
              </>
            )}
          </div>
        )}

        {/* MARCADOR: con shot 3 columnas (LOCAL | SHOT | VISITANTE); sin shot,
            2 columnas balanceadas. Activa 3 columnas desde `sm:` para que un
            phone en landscape también las use (no apile). En portrait phone
            se apila como antes. */}
        <div
          className={`flex-1 grid grid-cols-1 sm:items-stretch ${
            conShot ? 'sm:grid-cols-[1fr_auto_1fr]' : 'sm:grid-cols-2'
          }`}
          style={{
            // En mega minimizamos gap y padding para liberar todo el ancho
            // posible a los paneles (cada uno = 50vw - gap/2).
            gap: modoMega ? 'clamp(0.15rem, 0.3vmin, 0.5rem)' : 'clamp(0.5rem, 1.5vmin, 1.5rem)',
            paddingLeft: modoMega ? 'clamp(0.25rem, 0.6vmin, 0.75rem)' : 'clamp(0.5rem, 1.5vmin, 2rem)',
            paddingRight: modoMega ? 'clamp(0.25rem, 0.6vmin, 0.75rem)' : 'clamp(0.5rem, 1.5vmin, 2rem)',
            paddingBottom: modoMega ? 'clamp(0.25rem, 0.6vmin, 0.75rem)' : 'clamp(0.5rem, 1.5vmin, 2rem)',
          }}
        >
          <PanelEquipo
            nombre={m.nombre_local}
            puntos={m.puntos_local}
            faltas={m.faltas_local}
            timeouts={m.timeouts_local}
            lado="local"
            mega={modoMega}
            colorNombre={m.color_local}
            colorPuntos={m.color_puntos_local}
            fuente={fuenteM}
            neon={m.neon}
            digitosGlobal={digitosMax}
          />
          {conShot && (
            <div className="order-first sm:order-none sm:flex sm:items-center">
              <ShotClock ms={shotMs} fuenteCls={fuenteClsM} />
            </div>
          )}
          <PanelEquipo
            nombre={m.nombre_visitante}
            puntos={m.puntos_visitante}
            faltas={m.faltas_visitante}
            timeouts={m.timeouts_visitante}
            lado="visitante"
            mega={modoMega}
            colorNombre={m.color_visitante}
            colorPuntos={m.color_puntos_visitante}
            fuente={fuenteM}
            neon={m.neon}
            digitosGlobal={digitosMax}
          />
        </div>

        {/* FOOTER — se oculta en mega para liberar todo el alto al puntaje. */}
        {!modoMega && (
        <footer
          className="text-zinc-600 text-center uppercase tracking-[0.3em]"
          style={{
            paddingLeft: 'clamp(0.75rem, 1.5vmin, 2rem)',
            paddingRight: 'clamp(0.75rem, 1.5vmin, 2rem)',
            paddingTop: 'clamp(0.35rem, 0.8vmin, 0.8rem)',
            paddingBottom: 'clamp(0.35rem, 0.8vmin, 0.8rem)',
            fontSize: 'clamp(0.55rem, 0.95vmin, 1rem)',
          }}
        >
          <span className="text-zinc-500">{m.nombre_local}</span>{' '}
          <span className="font-orbitron font-bold text-zinc-300">
            {m.puntos_local} – {m.puntos_visitante}
          </span>{' '}
          <span className="text-zinc-500">{m.nombre_visitante}</span>
          <span className="mx-3 text-zinc-700">·</span>
          <span className="text-zinc-600">pichangas.cmt</span>
        </footer>
        )}
      </div>
    </div>
  );
}
