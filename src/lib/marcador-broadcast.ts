// Canal Realtime "broadcast" del marcador (efímero, no toca DB).
// El control panel emite un evento predicho ANTES de llamar al Server Action,
// y el visor lo aplica optimistamente para sentir "0 ms". La fuente de verdad
// sigue siendo postgres_changes, que reconcilia el estado al llegar.

import type { Marcador } from './types';

export type EventoFast =
  | { t: 'pts';     eq: 'l' | 'v'; d: number }
  | { t: 'fal';     eq: 'l' | 'v'; d: number }
  | { t: 'to';      eq: 'l' | 'v'; d: number }
  | { t: 'per';     d: number }
  | { t: 'bocina' }
  | { t: 'play';    nowMs: number }
  | { t: 'rReloj' }
  | { t: 'rShot';   seg: number; nowMs: number };

export function canalFast(id: string): string {
  return `mk-fast:${id}`;
}

// Aplica el evento a un Marcador imitando lo que hará el Server Action.
// Si nuestra predicción diverge, postgres_changes corrige al llegar.
export function aplicarEventoFast(m: Marcador, ev: EventoFast): Marcador {
  switch (ev.t) {
    case 'pts':
      return ev.eq === 'l'
        ? { ...m, puntos_local:     Math.max(0, m.puntos_local + ev.d) }
        : { ...m, puntos_visitante: Math.max(0, m.puntos_visitante + ev.d) };

    case 'fal':
      return ev.eq === 'l'
        ? { ...m, faltas_local:     Math.max(0, m.faltas_local + ev.d) }
        : { ...m, faltas_visitante: Math.max(0, m.faltas_visitante + ev.d) };

    case 'to':
      return ev.eq === 'l'
        ? { ...m, timeouts_local:     Math.max(0, m.timeouts_local + ev.d) }
        : { ...m, timeouts_visitante: Math.max(0, m.timeouts_visitante + ev.d) };

    case 'per': {
      // El server reinicia reloj, faltas y shot al cambiar de periodo.
      const periodo = Math.max(1, m.periodo + ev.d);
      return {
        ...m,
        periodo,
        reloj_restante_ms: m.duracion_periodo_seg * 1000,
        reloj_corriendo: false,
        reloj_inicio: null,
        faltas_local: 0,
        faltas_visitante: 0,
        shot_restante_ms: m.shot_duracion_ms,
        shot_corriendo: false,
        shot_inicio: null,
      };
    }

    case 'bocina':
      return { ...m, bocina_pulsos: (m.bocina_pulsos ?? 0) + 1 };

    case 'play': {
      const isoNow = new Date(ev.nowMs).toISOString();
      if (m.reloj_corriendo) {
        // Pausar: congelar los ms reales restantes en este instante.
        const eR = m.reloj_inicio
          ? Math.max(0, ev.nowMs - new Date(m.reloj_inicio).getTime())
          : 0;
        const eS = m.shot_corriendo && m.shot_inicio
          ? Math.max(0, ev.nowMs - new Date(m.shot_inicio).getTime())
          : 0;
        return {
          ...m,
          reloj_restante_ms: Math.max(0, m.reloj_restante_ms - eR),
          reloj_corriendo: false,
          reloj_inicio: null,
          shot_restante_ms: Math.max(0, m.shot_restante_ms - eS),
          shot_corriendo: false,
          shot_inicio: null,
        };
      }
      return {
        ...m,
        reloj_corriendo: true,
        reloj_inicio: isoNow,
        shot_corriendo: true,
        shot_inicio: isoNow,
      };
    }

    case 'rReloj':
      return {
        ...m,
        reloj_restante_ms: m.duracion_periodo_seg * 1000,
        reloj_corriendo: false,
        reloj_inicio: null,
      };

    case 'rShot': {
      const ms = Math.max(1, ev.seg) * 1000;
      const isoNow = new Date(ev.nowMs).toISOString();
      return {
        ...m,
        shot_duracion_ms: ms,
        shot_restante_ms: ms,
        shot_corriendo: m.reloj_corriendo,
        shot_inicio: m.reloj_corriendo ? isoNow : null,
      };
    }
  }
}
