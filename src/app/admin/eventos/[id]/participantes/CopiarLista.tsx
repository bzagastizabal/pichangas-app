// Genera un mensaje de WhatsApp con la convocatoria y la lista de inscritos.
// Toggles para incluir teléfonos, estado de pago, link de mapa y numeración.
'use client';

import { useMemo, useState } from 'react';
import type { EstadoPagoJugador } from '@/lib/estado-pago';

type Item = {
  nombre: string;
  telefono: string | null;
  estado: EstadoPagoJugador;
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
}) {
  const [conTel, setConTel] = useState(true);
  const [conPago, setConPago] = useState(true);
  const [conMapa, setConMapa] = useState(Boolean(sedeMapa));
  const [numerar, setNumerar] = useState(true);
  const [mostrarVacios, setMostrarVacios] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const texto = useMemo(() => {
    const lineas: string[] = [];
    lineas.push(`📣 ${titulo}`);
    lineas.push(`📍 ${sedeNombre}${sedeDireccion ? ` — ${sedeDireccion}` : ''}`);
    if (conMapa && sedeMapa) lineas.push(`🗺️ ${sedeMapa}`);
    lineas.push(`🗓️ ${fmtFecha(fechaIso)}`);
    lineas.push(`🕛 ${rangoHorario(fechaIso, duracionHoras)}`);
    lineas.push(`🤑 S/${costo} por jugador`);
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
    conTel,
    conPago,
    numerar,
    mostrarVacios,
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
          {copiado ? '✓ Copiado' : '📋 Copiar mensaje'}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
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
      </div>

      <pre className="rounded-lg bg-black/40 ring-1 ring-white/5 p-3 text-xs text-texto whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-auto">
        {texto}
      </pre>
    </div>
  );
}
