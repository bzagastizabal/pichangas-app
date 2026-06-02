// src/app/marcador/[slug]/VisorMarcador.tsx
// Visor a pantalla completa. Suscribe a Realtime, calcula el reloj con
// Date.now() para evitar drift, y ofrece "Pantalla completa" (F11/dispositivo).
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatearReloj,
  msRestantes,
  type Marcador,
} from '@/lib/types';

function Lado({
  nombre,
  puntos,
  faltas,
  timeouts,
}: {
  nombre: string;
  puntos: number;
  faltas: number;
  timeouts: number;
}) {
  const bonus = faltas >= 4;
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-4">
      <p className="text-[clamp(1.5rem,4vw,3.5rem)] uppercase tracking-widest text-zinc-300 truncate max-w-full">
        {nombre}
      </p>
      <p
        className="text-[clamp(6rem,22vw,20rem)] font-mono leading-none tabular-nums"
        style={{ textShadow: '0 0 30px rgba(251,146,60,0.35)' }}
      >
        {puntos}
      </p>
      <div className="mt-4 flex gap-8 text-[clamp(0.9rem,1.8vw,1.5rem)] text-zinc-300">
        <span>
          Faltas:{' '}
          <span className={bonus ? 'font-bold text-red-400' : 'font-bold text-white'}>
            {faltas}
          </span>
          {bonus && <span className="ml-2 rounded bg-red-500 px-2 text-sm text-white">BONUS</span>}
        </span>
        <span>
          TO: <span className="font-bold text-white">{timeouts}</span>
        </span>
      </div>
    </div>
  );
}

export function VisorMarcador({ inicial }: { inicial: Marcador }) {
  const [m, setM] = useState<Marcador>(inicial);
  const [relojMs, setRelojMs] = useState(inicial.reloj_restante_ms);
  const [shotMs, setShotMs] = useState(inicial.shot_restante_ms);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Realtime: suscripción a UPDATE de esta fila.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`marcador:public:${inicial.id}`)
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

  // Tick local: cada frame recalcula con Date.now() — robusto al drift.
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

  function pantallaCompleta() {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }

  const relojBajo = relojMs < 60_000;

  return (
    <div
      ref={rootRef}
      className="min-h-screen w-screen bg-black text-white flex flex-col"
      onDoubleClick={pantallaCompleta}
    >
      {/* Cabecera con periodo */}
      <header className="flex items-center justify-between px-6 py-3 text-zinc-400 text-sm">
        <span>CMT BasketBall Club</span>
        <span className="font-mono">Q{m.periodo}</span>
        <button
          type="button"
          onClick={pantallaCompleta}
          className="rounded border border-zinc-700 px-2 py-1 hover:border-orange-500"
          title="Doble click sobre la pantalla también activa fullscreen"
        >
          ⛶ Pantalla completa
        </button>
      </header>

      {/* Reloj principal grande */}
      <div className="text-center mt-2">
        <p
          className={`font-mono leading-none tabular-nums ${
            relojBajo ? 'text-red-400' : 'text-white'
          }`}
          style={{ fontSize: 'clamp(4rem, 14vw, 14rem)' }}
        >
          {formatearReloj(relojMs)}
        </p>
      </div>

      {/* Marcador */}
      <div className="flex-1 flex items-center justify-center gap-4">
        <Lado
          nombre={m.nombre_local}
          puntos={m.puntos_local}
          faltas={m.faltas_local}
          timeouts={m.timeouts_local}
        />
        <div className="flex flex-col items-center">
          <p className="text-zinc-400 text-sm">SHOT</p>
          <p
            className={`font-mono tabular-nums leading-none ${
              shotMs < 5000 ? 'text-red-400' : 'text-orange-400'
            }`}
            style={{ fontSize: 'clamp(3rem, 10vw, 10rem)' }}
          >
            {Math.ceil(shotMs / 1000)}
          </p>
        </div>
        <Lado
          nombre={m.nombre_visitante}
          puntos={m.puntos_visitante}
          faltas={m.faltas_visitante}
          timeouts={m.timeouts_visitante}
        />
      </div>

      <footer className="px-6 py-3 text-zinc-500 text-xs text-center">
        En vivo — {m.reloj_corriendo ? 'jugando' : 'detenido'}
      </footer>
    </div>
  );
}
