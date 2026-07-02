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

// Chicharra estilo NCAA Arena (bocina de partido universitario).
// Receta afinada por escucha:
//  - Fundamental grave 165 Hz (E3) para el "honk" profundo característico
//  - Harmónicos: octava (330) + 12va (495) + doble octava (660) — como una
//    bocina de aire de bocina metálica con resonancia
//  - Sub-oscilador sinusoidal a 82 Hz para cuerpo pero SIN opacar el mid
//  - Filtro pasa-bajos con Q alta y CUT constante (sin sweep) para el sonido
//    sostenido "no sintetizador" — el sweep era lo que sonaba a videojuego
//  - LFO de vibrato ~4 Hz sobre las capas (simula la vibración de la lengüeta)
//  - Ráfaga de aire inicial (ruido bandpass 800 Hz) más gorda que antes
//  - Attack de 30 ms; sostiene y hace tail exponencial de 400 ms
export function tocarBocina(corta = false, volumen = 0.5): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const t = c.currentTime;
  const duracion = corta ? 0.55 : 2.5;
  const releaseDur = 0.4;

  // Master con envelope sostenido.
  const master = c.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(volumen, t + 0.03);
  master.gain.setValueAtTime(volumen, t + duracion);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duracion + releaseDur);
  master.connect(c.destination);

  // Filtro pasa-bajos FIJO (sin sweep) para que suene sostenido, no
  // "wah". Cut en 1600 Hz, Q moderada para dar carácter sin nasalidad.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600;
  lp.Q.value = 2.2;
  lp.connect(master);

  // Sub grave 82 Hz (E2), gordo pero sin dominar.
  const subOsc = c.createOscillator();
  const subGain = c.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.value = 82;
  subGain.gain.value = 0.5;
  subOsc.connect(subGain).connect(master);
  subOsc.start(t);
  subOsc.stop(t + duracion + releaseDur + 0.05);

  // LFO ~4 Hz de vibrato sutil (±3 cents) — la vibración de la lengüeta
  // metálica de una bocina real. Sin esto suena demasiado "estático".
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 4;
  lfoGain.gain.value = 3; // ±3 cents
  lfo.connect(lfoGain);
  lfo.start(t);
  lfo.stop(t + duracion + releaseDur + 0.05);

  // Capas: fundamental 165 Hz (E3), octava 330, 12va 495, doble octava 660.
  // El "aire" del horn = sawtooth suave; la resonancia = square más apagada.
  const capas: Array<{ hz: number; nivel: number; tipo: OscillatorType }> = [
    { hz: 165,  nivel: 0.95, tipo: 'sawtooth' },
    { hz: 165,  nivel: 0.55, tipo: 'square'   },
    { hz: 330,  nivel: 0.65, tipo: 'sawtooth' },
    { hz: 495,  nivel: 0.35, tipo: 'sawtooth' },
    { hz: 660,  nivel: 0.20, tipo: 'triangle' },
  ];
  for (const capa of capas) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = capa.tipo;
    o.frequency.value = capa.hz;
    lfoGain.connect(o.detune); // vibrato del LFO
    g.gain.value = capa.nivel;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + duracion + releaseDur + 0.05);
  }

  // Ráfaga inicial de aire (100 ms, bandpass 800 Hz) — más gorda que antes,
  // simula el arranque físico de la boca del horn.
  const noiseDur = 0.1;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * noiseDur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2);
  }
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = buf;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 800;
  noiseFilter.Q.value = 0.5;
  const noiseGain = c.createGain();
  noiseGain.gain.value = volumen * 0.75;
  noiseSrc
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(c.destination);
  noiseSrc.start(t);
}
