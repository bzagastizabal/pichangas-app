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

// Beep corto y agudo (~120ms). Usado para los últimos 5s del shot y para la
// cuenta atrás del cronómetro (ahí subimos la frecuencia en los últimos
// segundos para que se distinga el final sin mirar la pantalla).
export function tocarBeep(volumen = 0.25, frecuencia = 1000): void {
  const c = ctx;
  if (!c || !unlocked) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = frecuencia;
  const t = c.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.005);
  gain.gain.setValueAtTime(volumen, t + 0.1);
  gain.gain.linearRampToValueAtTime(0, t + 0.13);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

// ---- Voz sintetizada (Web Speech API) ----------------------------------
// Anuncia texto con voz femenina en español para el modo cronometro.
// La API es síncrona; los navegadores traen voces preinstaladas y elegimos
// la mejor femenina en 'es-*' (Mónica en macOS/iOS, Paulina en Windows,
// Google es-US en Android). Si no hay ninguna, usa la default del sistema.

let vozPref: SpeechSynthesisVoice | null = null;
const VOZ_KEY = 'marcador.voz'; // localStorage — nombre exacto de la voz.

// Nombres masculinos conocidos que priorizamos EVITAR (por si el sistema
// solo tiene una voz "es-" y es masculina). No es exhaustivo — el usuario
// siempre puede elegir manualmente desde el visor.
const NOMBRES_MASCULINOS = [
  'Juan', 'Diego', 'Jorge', 'Pablo', 'Enrique', 'Carlos', 'Manuel',
  'Miguel', 'Roberto', 'Luis',
  // iOS/macOS
  'Jorge',
  // Microsoft es-
  'Pablo', 'Sergio', 'Alonso',
];

// Nombres femeninos conocidos que priorizamos.
const NOMBRES_FEMENINOS = [
  'Monica', 'Mónica', 'Paulina', 'Sabina', 'Helena', 'Laura',
  'Esperanza', 'Marisol', 'Isabela', 'Camila', 'Elena', 'Salma',
  'Sofía', 'Dalia', 'Ximena',
];

function esFemenina(nombre: string): boolean {
  return NOMBRES_FEMENINOS.some((f) => nombre.includes(f));
}
function esMasculina(nombre: string): boolean {
  return NOMBRES_MASCULINOS.some((m) => nombre.includes(m));
}

function elegirVozAuto(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voces.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!es.length) return null;
  // 1) Femenina conocida.
  const fem = es.find((v) => esFemenina(v.name));
  if (fem) return fem;
  // 2) Google (suele ser femenina en Android/Chrome).
  const google = es.find((v) => v.name.toLowerCase().includes('google') && !esMasculina(v.name));
  if (google) return google;
  // 3) Cualquiera que NO esté en la lista masculina.
  const noMasc = es.find((v) => !esMasculina(v.name));
  if (noMasc) return noMasc;
  // 4) Última: cualquier es-*.
  return es[0] ?? null;
}

function cargarVozPref(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voces = window.speechSynthesis.getVoices();
  const aplicar = (voces: SpeechSynthesisVoice[]) => {
    // Preferencia guardada por el usuario tiene prioridad si aún existe.
    const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem(VOZ_KEY) : null;
    if (guardado) {
      const encontrada = voces.find((v) => v.name === guardado);
      if (encontrada) {
        vozPref = encontrada;
        return;
      }
    }
    vozPref = elegirVozAuto(voces);
  };
  if (voces.length) aplicar(voces);
  else {
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => aplicar(window.speechSynthesis.getVoices()),
      { once: true },
    );
  }
}

// Reproduce el texto con la voz preferida. Cancela cualquier anuncio en curso
// para que los números de la cuenta detallada no se apilen. `veces` repite el
// mismo texto encolando utterances (el motor las reproduce en orden, con una
// pausa natural entre ellas): el club pidió que cada aviso se oiga 2 veces.
export function anunciarVoz(
  texto: string,
  opciones?: { rate?: number; volumen?: number; veces?: number },
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!vozPref) cargarVozPref();
  const veces = Math.max(1, Math.min(3, Math.round(opciones?.veces ?? 1)));
  window.speechSynthesis.cancel();
  for (let i = 0; i < veces; i++) {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = vozPref?.lang ?? 'es-ES';
    u.rate = opciones?.rate ?? 1.15;
    u.volume = opciones?.volumen ?? 1;
    if (vozPref) u.voice = vozPref;
    window.speechSynthesis.speak(u);
  }
}

// Lista las voces en español disponibles en este dispositivo. Devuelve un
// array; puede estar vacío en el primer render (voiceschanged aún no disparó)
// — el UI debe refrescarse cuando cambia.
export function listarVocesEs(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
}

// Permite al usuario forzar una voz específica. Persiste el nombre en
// localStorage (por-dispositivo, no per-marcador porque las voces disponibles
// dependen del sistema del que ve el marcador).
export function setVozPreferida(nombre: string | null): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!nombre) {
    localStorage.removeItem(VOZ_KEY);
    vozPref = elegirVozAuto(window.speechSynthesis.getVoices());
    return;
  }
  const voces = window.speechSynthesis.getVoices();
  const v = voces.find((x) => x.name === nombre);
  if (!v) return;
  vozPref = v;
  localStorage.setItem(VOZ_KEY, nombre);
}

// Nombre de la voz actualmente activa (para mostrarlo en el UI).
export function nombreVozActiva(): string | null {
  return vozPref?.name ?? null;
}

// Suscripción a cambios en el catálogo de voces del navegador (algunos SO las
// cargan asincrónicamente). Devuelve un unsub para React useEffect.
export function suscribirVoces(cb: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => {};
  const handler = () => cb();
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
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

// ---- Packs de voz (clips subidos por el admin, SQL 37) -------------------
// Precargamos los audios en AudioBuffers: se disparan con la misma latencia
// que el beep y comparten el desbloqueo del AudioContext (clave en iOS, donde
// un <audio> nuevo por aviso quedaría bloqueado).

const clips = new Map<string, AudioBuffer>();
let paqueteCargado: string | null = null;

// Descarga y decodifica los clips del pack. Idempotente por id de pack: si ya
// está cargado no vuelve a bajar nada. Los clips rotos se ignoran (ese aviso
// cae a la voz sintetizada).
export async function cargarPaqueteVoz(
  paqueteId: string | null,
  urlsPorClave: Record<string, string>,
): Promise<number> {
  if (paqueteCargado === paqueteId) return clips.size;
  paqueteCargado = paqueteId;
  clips.clear();
  if (!paqueteId) return 0;
  const c = getCtx();
  if (!c) return 0;
  await Promise.all(
    Object.entries(urlsPorClave).map(async ([clave, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const datos = await res.arrayBuffer();
        clips.set(clave, await c.decodeAudioData(datos));
      } catch {
        // Sin clip: el visor usará anunciarVoz() para ese aviso.
      }
    }),
  );
  return clips.size;
}

export function hayClip(clave: string): boolean {
  return clips.has(clave);
}

export function clipsCargados(): number {
  return clips.size;
}

// Reproduce el clip `veces` seguidas (con un respiro entre repeticiones).
// Devuelve false si no existe o el audio no está desbloqueado: el llamador
// debe caer a anunciarVoz().
export function reproducirClip(
  clave: string,
  opciones?: { veces?: number; volumen?: number },
): boolean {
  const c = ctx;
  const buf = clips.get(clave);
  if (!c || !unlocked || !buf) return false;
  const veces = Math.max(1, Math.min(3, Math.round(opciones?.veces ?? 1)));
  const gain = c.createGain();
  gain.gain.value = opciones?.volumen ?? 1;
  gain.connect(c.destination);
  let t = c.currentTime;
  for (let i = 0; i < veces; i++) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(t);
    t += buf.duration + 0.25;
  }
  return true;
}
