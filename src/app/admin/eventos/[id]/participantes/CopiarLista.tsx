// Genera un mensaje de WhatsApp con la convocatoria. Dos modos:
//  - 'lista': convocatoria + lista de inscritos (toggles de teléfonos, estado
//    de pago, numeración, vacíos y "En espera").
//  - 'info': solo los datos de la pichanga y los cupos disponibles, sin
//    nombres — para promocionar en grupos donde no conviene exponer la lista.
'use client';

import { useMemo, useState } from 'react';
import type { EstadoPagoJugador } from '@/lib/estado-pago';

type Item = {
  nombre: string;
  telefono: string | null;
  estado: EstadoPagoJugador;
};

type ItemEspera = {
  nombre: string;
  telefono: string | null;
  // 'liberado' = tenía cupo y fue desplazado · 'espera' = entró cuando ya no había cupo
  tipo: 'liberado' | 'espera';
};

const EMOJI_ESPERA: Record<ItemEspera['tipo'], string> = {
  liberado: '🔄',
  espera: '⏰',
};

const EMOJI_PAGO: Record<EstadoPagoJugador, string> = {
  pagado: '✅',
  en_revision: '⏳',
  pendiente: '💸',
  moroso: '❌',
};

const ZONA = 'America/Lima';

function fmtFecha(iso: string): string {
  // "sábado 13 jun" — capitaliza la primera letra
  const t = new Date(iso).toLocaleDateString('es-PE', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fmtHora(d: Date): string {
  // "10:00 a. m." -> "10:00 am"
  return d
    .toLocaleString('es-PE', {
      timeZone: ZONA,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/a\.\s*m\./gi, 'am')
    .replace(/p\.\s*m\./gi, 'pm')
    .replace(/\s+/g, ' ')
    .trim();
}

// Línea de cupos del modo 'info': singular, lleno (la inscripción sigue
// abierta como lista de espera) y el total para dar contexto.
function lineaCupos(disponibles: number, totales: number): string {
  if (disponibles <= 0) return '⛔ Cupos completos — inscríbete en la lista de espera';
  if (disponibles === 1) return `🔥 ¡Queda 1 cupo disponible! (de ${totales})`;
  return `🔥 Quedan ${disponibles} cupos disponibles (de ${totales})`;
}

type Modo = 'lista' | 'info';

function rangoHorario(isoInicio: string, duracionH: number): string {
  const ini = new Date(isoInicio);
  const fin = new Date(ini.getTime() + duracionH * 3600 * 1000);
  return `${fmtHora(ini)} a ${fmtHora(fin)}`;
}

export function CopiarLista({
  titulo,
  sedeNombre,
  sedeDireccion,
  sedeMapa,
  fechaIso,
  duracionHoras,
  costo,
  cuposTotales,
  cuposDisponibles,
  inscribirUrl,
  items,
  enEspera = [],
}: {
  titulo: string;
  sedeNombre: string;
  sedeDireccion: string | null;
  sedeMapa: string | null;
  fechaIso: string;
  duracionHoras: number;
  costo: number;
  cuposTotales: number;
  cuposDisponibles: number;
  inscribirUrl: string;
  items: Item[];
  enEspera?: ItemEspera[];
}) {
  const [conTel, setConTel] = useState(true);
  const [conPago, setConPago] = useState(true);
  const [conMapa, setConMapa] = useState(Boolean(sedeMapa));
  const [numerar, setNumerar] = useState(true);
  const [mostrarVacios, setMostrarVacios] = useState(true);
  const [conEspera, setConEspera] = useState(true);
  const [modo, setModo] = useState<Modo>('lista');
  const [copiado, setCopiado] = useState(false);

  const texto = useMemo(() => {
    const lineas: string[] = [];
    lineas.push(`📣 ${titulo}`);
    lineas.push(`📍 ${sedeNombre}${sedeDireccion ? ` — ${sedeDireccion}` : ''}`);
    if (conMapa && sedeMapa) lineas.push(`🗺️ ${sedeMapa}`);
    lineas.push(`🗓️ ${fmtFecha(fechaIso)}`);
    lineas.push(`🕛 ${rangoHorario(fechaIso, duracionHoras)}`);
    lineas.push(`🤑 S/${costo} por jugador`);
    if (modo === 'info') {
      lineas.push(lineaCupos(cuposDisponibles, cuposTotales));
      lineas.push(`👉 Inscríbete: ${inscribirUrl}`);
      return lineas.join('\n');
    }
    lineas.push(`${cuposDisponibles} cupos disponibles`);
    lineas.push(`👉 Inscríbete: ${inscribirUrl}`);
    lineas.push('');
    lineas.push(`Lista (${items.length}/${cuposTotales}):`);
    // Cuando hay que mostrar los vacíos, iteramos hasta cuposTotales y
    // rellenamos con "—". Si no, solo iteramos los inscritos.
    const filas = mostrarVacios ? cuposTotales : items.length;
    for (let i = 0; i < filas; i++) {
      const j = items[i];
      const prefijo = numerar ? `${i + 1}.` : '-';
      if (j) {
        const pago = conPago ? `${EMOJI_PAGO[j.estado]} ` : '';
        const tel = conTel && j.telefono ? ` · ${j.telefono}` : '';
        lineas.push(`${prefijo} ${pago}${j.nombre}${tel}`);
      } else {
        lineas.push(`${prefijo} —`);
      }
    }

    // Sección "En espera" (liberados + lista_espera). Solo aparece si hay
    // alguien y el toggle está prendido. El que yapee primero recupera cupo.
    if (conEspera && enEspera.length > 0) {
      lineas.push('');
      lineas.push('En espera (el que paga primero recupera cupo):');
      enEspera.forEach((j, i) => {
        const prefijo = numerar ? `${i + 1}.` : '-';
        const tipoEmoji = `${EMOJI_ESPERA[j.tipo]} `;
        const tel = conTel && j.telefono ? ` · ${j.telefono}` : '';
        lineas.push(`${prefijo} ${tipoEmoji}${j.nombre}${tel}`);
      });
    }

    return lineas.join('\n');
  }, [
    titulo,
    sedeNombre,
    sedeDireccion,
    sedeMapa,
    conMapa,
    fechaIso,
    duracionHoras,
    costo,
    cuposDisponibles,
    cuposTotales,
    inscribirUrl,
    items,
    enEspera,
    conTel,
    conPago,
    numerar,
    mostrarVacios,
    conEspera,
    modo,
  ]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Fallback antiguo: seleccionar texto en un textarea oculto.
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    }
  }

  return (
    <div className="rounded-lg border border-borde p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Compartir por WhatsApp</h2>
        <button
          type="button"
          onClick={copiar}
          className={`rounded px-3 py-1.5 text-sm font-medium text-white transition ${
            copiado ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-500'
          }`}
        >
          {copiado ? '✓ Copiado' : modo === 'info' ? '📋 Copiar solo info' : '📋 Copiar mensaje'}
        </button>
      </div>

      {/* Qué se copia: la vista previa de abajo muestra exactamente ese texto. */}
      <div className="inline-flex rounded-lg ring-1 ring-white/10 bg-black/30 p-0.5 text-xs">
        {(
          [
            { valor: 'lista', etiqueta: '👥 Con lista de inscritos' },
            { valor: 'info', etiqueta: '📣 Solo info y cupos' },
          ] as const
        ).map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => {
              setModo(op.valor);
              setCopiado(false);
            }}
            aria-pressed={modo === op.valor}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              modo === op.valor
                ? 'bg-orange-600 text-white'
                : 'text-tenue hover:text-texto'
            }`}
          >
            {op.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
        {modo === 'lista' && (
          <>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={conTel}
                onChange={(e) => setConTel(e.target.checked)}
              />
              Teléfonos
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={conPago}
                onChange={(e) => setConPago(e.target.checked)}
              />
              Estado de pago (✅⏳💸)
            </label>
          </>
        )}
        {sedeMapa && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={conMapa}
              onChange={(e) => setConMapa(e.target.checked)}
            />
            Link del lugar
          </label>
        )}
        {modo === 'lista' && (
          <>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={numerar}
                onChange={(e) => setNumerar(e.target.checked)}
              />
              Numerar lista
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarVacios}
                onChange={(e) => setMostrarVacios(e.target.checked)}
              />
              Mostrar cupos vacíos
            </label>
          </>
        )}
        {modo === 'lista' && enEspera.length > 0 && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={conEspera}
              onChange={(e) => setConEspera(e.target.checked)}
            />
            Mostrar “En espera” ({enEspera.length})
          </label>
        )}
      </div>

      <pre className="rounded-lg bg-black/40 ring-1 ring-white/5 p-3 text-xs text-texto whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-auto">
        {texto}
      </pre>
    </div>
  );
}
