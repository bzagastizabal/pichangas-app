// Sintetiza los sonidos del marcador (bocina y beep) con Web Audio API. No
// requiere archivos ni red. Los navegadores exigen un gesto del usuario para
// iniciar audio, por eso hay un `desbloquear()` que se llama al primer click.

let ctx: AudioContext | null = null;
let unlocked = false;

type AudioCtxCtor = typeof AudioContext;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const w = window as Window & { webkitAudioContext?: AudioCtxCtor };
    const Ctor: AudioCtxCtor | undefined = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

// Habilita el AudioContext tras un gesto del usuario. Idempotente.
export async function desbloquearAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  unlocked = c.state === 'running';
  return unlocked;
}

export function audioDesbloqueado(): boolean {
  return unlocked && ctx?.state === 'running';
}

// Beep corto y agudo (1000Hz square ~120ms). Usado para los últimos 5s del shot.
export function tocarBeep(volumen = 0.25): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = 1000;
  const t = c.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.005);
  gain.gain.setValueAtTime(volumen, t + 0.1);
  gain.gain.linearRampToValueAtTime(0, t + 0.13);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

// Tipos de bocina disponibles — sync con SQL 34.
export type BocinaTipo = 'ncaa' | 'nba' | 'high_school' | 'air_horn';

// Cada variante define los parámetros que la diferencian; el motor común
// abajo arma la señal (subosc + LFO + capas + LP + ráfaga inicial).
type BocinaReceta = {
  duracionCorta: number;   // segundos (short — fin de shot)
  duracionLarga: number;   // segundos (long — fin de periodo o manual)
  release: number;         // exponential decay tail
  subHz: number;           // frecuencia del sub-oscilador (sine)
  subNivel: number;        // 0..1; 0 = sin sub (air horn)
  lpFreq: number;          // cutoff del pasa-bajos fijo
  lpQ: number;
  lfoHz: number;           // frecuencia de vibrato
  lfoCents: number;        // amplitud del vibrato en cents; 0 = sin vibrato
  capas: Array<{ hz: number; nivel: number; tipo: OscillatorType }>;
  aireDur: number;         // duración de la ráfaga inicial de ruido
  aireHz: number;          // centro del bandpass del ruido
  aireQ: number;
  aireNivel: number;       // multiplicador vs volumen
};

const RECETAS: Record<BocinaTipo, BocinaReceta> = {
  // NCAA Arena — universitario clásico, honk grave sostenido con vibrato leve.
  ncaa: {
    duracionCorta: 0.55, duracionLarga: 2.5, release: 0.4,
    subHz: 82, subNivel: 0.5,
    lpFreq: 1600, lpQ: 2.2,
    lfoHz: 4, lfoCents: 3,
    capas: [
      { hz: 165, nivel: 0.95, tipo: 'sawtooth' },
      { hz: 165, nivel: 0.55, tipo: 'square'   },
      { hz: 330, nivel: 0.65, tipo: 'sawtooth' },
      { hz: 495, nivel: 0.35, tipo: 'sawtooth' },
      { hz: 660, nivel: 0.20, tipo: 'triangle' },
    ],
    aireDur: 0.1, aireHz: 800, aireQ: 0.5, aireNivel: 0.75,
  },
  // NBA Arena — más grave y más largo, con wobble marcado tipo estadio pro.
  nba: {
    duracionCorta: 0.6, duracionLarga: 3.0, release: 0.5,
    subHz: 65, subNivel: 0.7,
    lpFreq: 2000, lpQ: 1.5,
    lfoHz: 2.5, lfoCents: 20,  // wobble mucho más notorio
    capas: [
      { hz: 130, nivel: 0.95, tipo: 'sawtooth' },
      { hz: 130, nivel: 0.6,  tipo: 'square'   },
      { hz: 260, nivel: 0.70, tipo: 'sawtooth' },
      { hz: 390, nivel: 0.30, tipo: 'sawtooth' },
      { hz: 520, nivel: 0.15, tipo: 'triangle' },
    ],
    aireDur: 0.06, aireHz: 500, aireQ: 0.4, aireNivel: 0.55,
  },
  // High school gym — aguda, seca, sin fanfarria.
  high_school: {
    duracionCorta: 0.4, duracionLarga: 1.5, release: 0.25,
    subHz: 120, subNivel: 0.3,
    lpFreq: 2400, lpQ: 1.0,
    lfoHz: 0, lfoCents: 0,   // sin vibrato
    capas: [
      { hz: 240, nivel: 0.9,  tipo: 'sawtooth' },
      { hz: 480, nivel: 0.55, tipo: 'sawtooth' },
      { hz: 720, nivel: 0.25, tipo: 'triangle' },
    ],
    aireDur: 0.03, aireHz: 1200, aireQ: 0.8, aireNivel: 0.4,
  },
  // Air horn — festivalero/vuvuzela, alto y brillante, sin sub.
  air_horn: {
    duracionCorta: 0.5, duracionLarga: 2.0, release: 0.3,
    subHz: 0, subNivel: 0,    // sin sub (característico del air horn)
    lpFreq: 3200, lpQ: 0.8,
    lfoHz: 0, lfoCents: 0,
    capas: [
      { hz: 480,  nivel: 0.85, tipo: 'square'   },  // fundamental cuadrada agresiva
      { hz: 720,  nivel: 0.60, tipo: 'sawtooth' },
      { hz: 960,  nivel: 0.45, tipo: 'sawtooth' },
      { hz: 1440, nivel: 0.25, tipo: 'triangle' },
    ],
    aireDur: 0.04, aireHz: 2000, aireQ: 0.6, aireNivel: 0.5,
  },
};

// Chicharra/horn — reproduce la variante indicada por `tipo`. El engine
// común usa: sub-osc sine + LFO de vibrato + N capas armónicas → LP fijo →
// master envelope; más una ráfaga de ruido inicial paralela para el aire.
export function tocarBocina(corta = false, tipo: BocinaTipo = 'ncaa', volumen = 0.5): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const r = RECETAS[tipo] ?? RECETAS.ncaa;
  const t = c.currentTime;
  const duracion = corta ? r.duracionCorta : r.duracionLarga;
  const fin = t + duracion + r.release + 0.05;

  const master = c.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(volumen, t + 0.03);
  master.gain.setValueAtTime(volumen, t + duracion);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duracion + r.release);
  master.connect(c.destination);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = r.lpFreq;
  lp.Q.value = r.lpQ;
  lp.connect(master);

  // Sub grave (si aplica — air horn lo omite).
  if (r.subNivel > 0 && r.subHz > 0) {
    const subOsc = c.createOscillator();
    const subGain = c.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.value = r.subHz;
    subGain.gain.value = r.subNivel;
    subOsc.connect(subGain).connect(master);
    subOsc.start(t);
    subOsc.stop(fin);
  }

  // LFO de vibrato (0 cents = sin vibrato).
  let lfoGain: GainNode | null = null;
  if (r.lfoCents > 0 && r.lfoHz > 0) {
    const lfo = c.createOscillator();
    lfoGain = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = r.lfoHz;
    lfoGain.gain.value = r.lfoCents;
    lfo.connect(lfoGain);
    lfo.start(t);
    lfo.stop(fin);
  }

  // Capas armónicas.
  for (const capa of r.capas) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = capa.tipo;
    o.frequency.value = capa.hz;
    if (lfoGain) lfoGain.connect(o.detune);
    g.gain.value = capa.nivel;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(fin);
  }

  // Ráfaga inicial de aire (la parte "física" del arranque del horn).
  if (r.aireDur > 0) {
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * r.aireDur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2);
    }
    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf;
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = r.aireHz;
    noiseFilter.Q.value = r.aireQ;
    const noiseGain = c.createGain();
    noiseGain.gain.value = volumen * r.aireNivel;
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(c.destination);
    noiseSrc.start(t);
  }
}
