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

// Bocina/chicharra: dos osciladores sawtooth en octavas (220Hz + 440Hz) con
// envelope. `corta=true` la usamos al expirar el shot; sin `corta` es el horn
// largo de fin de periodo / disparada manual.
export function tocarBocina(corta = false, volumen = 0.3): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const duracion = corta ? 0.6 : 2.4;
  const t = c.currentTime;

  const osc1 = c.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 220;
  const osc2 = c.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 440;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.04);
  gain.gain.setValueAtTime(volumen, t + duracion - 0.15);
  gain.gain.linearRampToValueAtTime(0, t + duracion);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(c.destination);
  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + duracion + 0.05);
  osc2.stop(t + duracion + 0.05);
}
