// src/app/marcador/[slug]/VisorMarcador.tsx
// Pantalla pública del marcador (proyección). Diseño broadcast: tipografía
// LED (Orbitron) con glow, insignia CMT como watermark, cards de equipo con
// gradiente, BONUS y último minuto en rojo pulsante, shot < 5s en rojo,
// flash al cambiar el puntaje. Responsivo de móvil a 4K.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatearReloj, msRestantes, type Marcador } from '@/lib/types';
import {
  audioDesbloqueado,
  desbloquearAudio,
  tocarBeep,
  tocarBocina,
} from '@/lib/audio-marcador';
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

// Sync con SQL 31 + globals.css. Devuelve la clase Tailwind para la fuente.
const FUENTE_CLS: Record<string, string> = {
  orbitron:   'font-orbitron',
  bebas:      'font-bebas',
  anton:      'font-anton',
  iceland:    'font-iceland',
  rubik_mono: 'font-rubik-mono',
};

// Ratio empírico ancho-glifo / font-size en 'font-black' + tabular-nums (medido
// en 4K). Orbitron y Rubik Mono son casi cuadradas; Bebas/Anton condensed; Iceland
// medio. Sirve para calcular el vw máximo por dígito sin desbordar el panel.
const RATIO_GLIFO: Record<string, number> = {
  orbitron:   0.57,
  bebas:      0.36,
  anton:      0.48,
  iceland:    0.50,
  rubik_mono: 0.80,
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
}) {
  const bonus = faltas >= 4;
  const flash = useFlashAlCambiar(puntos);
  const acento = ACENTO[lado];

  // En mega escalamos según la cantidad de dígitos del puntaje para que dos
  // o tres dígitos no se desborden del panel (cada panel = 50vw en landscape).
  // Para nombre y puntaje usamos min(vh, vw) — vh limita la altura disponible
  // y vw limita el ancho del panel para no chocar con el panel de al lado.
  const digitos = Math.max(1, String(Math.max(0, puntos)).length);
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
      {/* Indicador de acento + nombre — más prominente para identificar al equipo */}
      <div className="flex items-center gap-[1.2vmin] max-w-full">
        <span
          className={`rounded-full ${acento.punto}`}
          style={{ width: 'clamp(0.6rem, 1.4vmin, 1.5rem)', height: 'clamp(0.6rem, 1.4vmin, 1.5rem)' }}
          aria-hidden
        />
        <p
          className="uppercase tracking-[0.18em] font-bold truncate"
          style={{
            color: colorTxt,
            // min(vh,vw) protege contra desborde horizontal del nombre en mega
            // landscape donde el panel mide ~50vw.
            fontSize: mega
              ? 'clamp(1.8rem, min(13vh, 5vw), 16rem)'
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
        className={`${fuenteCls} font-black tabular-nums leading-none ${flash ? 'animate-flash-score' : ''}`}
        style={{
          // En mega crecemos al máximo: min(92vh, vwPunto*vw). vwPunto se
          // calcula por dígitos × ratio del glifo de la fuente elegida.
          fontSize: mega
            ? `clamp(8rem, min(92vh, ${vwPunto}vw), 140rem)`
            : 'clamp(5rem, 32vmin, 40rem)',
          marginTop: mega
            ? 'clamp(0.05rem, 0.2vmin, 0.4rem)'
            : 'clamp(0.5rem, 1.5vmin, 2rem)',
          color: colorPts,
          textShadow: acento.glow,
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

export function VisorMarcador({ inicial }: { inicial: Marcador }) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const [sonidoOn, setSonidoOn] = useState(false);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Refs para detectar transiciones de segundo sin re-disparar el RAF.
  const lastShotSecRef = useRef<number>(Math.ceil(inicial.shot_restante_ms / 1000));
  const lastRelojPosRef = useRef<boolean>(inicial.reloj_restante_ms > 0);
  const lastBocinaRef = useRef<number>(inicial.bocina_pulsos ?? 0);

  async function alternarSonido() {
    if (sonidoOn) {
      setSonidoOn(false);
      return;
    }
    const ok = await desbloquearAudio();
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
    const chFast = supabase
      .channel(canalFast(inicial.id))
      .on('broadcast', { event: 'ev' }, ({ payload }) => {
        setM((prev) => aplicarEventoFast(prev, payload as EventoFast));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chDb);
      supabase.removeChannel(chFast);
    };
  }, [inicial.id]);

  // Tick local con requestAnimationFrame para reloj y shot. También dispara
  // sonidos automáticos: beep cada segundo del shot del 5 al 1, chicharra
  // corta al expirar el shot, chicharra larga al expirar el reloj.
  useEffect(() => {
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
          else if (shotSec === 0) tocarBocina(true);
          lastShotSecRef.current = shotSec;
        } else if (shotSec > lastShotSecRef.current) {
          // Reset (admin pulsó "24" o "14") — solo reseteamos el ref, no suena.
          lastShotSecRef.current = shotSec;
        }
      } else {
        lastShotSecRef.current = Math.ceil(nuevoShot / 1000);
      }

      // Bocina larga al expirar el reloj de juego (solo si estaba corriendo).
      const positivo = nuevoReloj > 0;
      if (
        sonidoOn &&
        m.reloj_corriendo &&
        lastRelojPosRef.current &&
        !positivo
      ) {
        tocarBocina(false);
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
      tocarBocina(false);
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

  // Estilo configurable (SQL 31). Fallbacks para marcadores previos.
  const fuenteM = (m.fuente as string) ?? 'orbitron';
  const fuenteClsM = FUENTE_CLS[fuenteM] ?? FUENTE_CLS.orbitron;
  const HEX = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
  const colorFondoM = m.color_fondo && HEX.test(m.color_fondo) ? m.color_fondo : '#000000';

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
