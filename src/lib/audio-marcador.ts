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

// Chicharra/horn estilo broadcast (más natural, menos "videojuego").
// Receta:
//  - Fundamental + 5ta + octava con detune leve (efecto coro)
//  - Sub-oscilador senoidal a 110 Hz para cuerpo grave
//  - Filtro pasa-bajos con resonancia para suavizar los aserrados
//  - Ráfaga de ruido filtrado al inicio (la "ráfaga de aire" del horn)
//  - Pitch envelope: arranca un poco arriba y baja al fundamental (boca de horn)
//  - Envelope master con attack rápido y release exponencial
export function tocarBocina(corta = false, volumen = 0.4): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const t = c.currentTime;
  const duracion = corta ? 0.55 : 2.0;
  const releaseDur = 0.35;

  // Salida master con envelope.
  const master = c.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(volumen, t + 0.02);
  master.gain.setValueAtTime(volumen, t + duracion);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duracion + releaseDur);
  master.connect(c.destination);

  // Filtro pasa-bajos que "suaviza" los aserrados sin matar los armónicos.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2800, t);
  lp.frequency.exponentialRampToValueAtTime(1300, t + 0.08);
  lp.Q.value = 3;
  lp.connect(master);

  // Sub grave (cuerpo).
  const subOsc = c.createOscillator();
  const subGain = c.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.value = 110;
  subGain.gain.value = 0.55;
  subOsc.connect(subGain).connect(master);
  subOsc.start(t);
  subOsc.stop(t + duracion + releaseDur + 0.05);

  // Capas de sawtooth: power chord 220 + 330 (5ta) + 440 (octava),
  // con detuning leve para efecto chorus.
  const capas: Array<{ hz: number; nivel: number; detune: number }> = [
    { hz: 220, nivel: 0.85, detune: 0 },
    { hz: 220, nivel: 0.65, detune: 8 },
    { hz: 330, nivel: 0.55, detune: -6 },
    { hz: 440, nivel: 0.35, detune: 4 },
  ];
  for (const capa of capas) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(capa.hz * 1.04, t); // pitch bend de arranque
    o.frequency.exponentialRampToValueAtTime(capa.hz, t + 0.08);
    o.detune.value = capa.detune;
    g.gain.value = capa.nivel;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + duracion + releaseDur + 0.05);
  }

  // Ráfaga de aire al inicio (50 ms de ruido filtrado, decaimiento exp).
  const noiseDur = 0.06;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * noiseDur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
  }
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = buf;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1500;
  noiseFilter.Q.value = 0.7;
  const noiseGain = c.createGain();
  noiseGain.gain.value = volumen * 0.6;
  noiseSrc
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(c.destination);
  noiseSrc.start(t);
}
