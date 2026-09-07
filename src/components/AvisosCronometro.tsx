// src/components/AvisosCronometro.tsx
// Config de avisos del modo cronómetro (SQL 36). Se usa en el panel de control
// y en el dock del visor, por eso el estado es controlado y se re-sincroniza
// cuando llega un UPDATE por Realtime (otro operador pudo cambiarlo).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { actualizarAvisos } from '@/app/admin/marcadores/[id]/control/actions';
import { createClient } from '@/lib/supabase/client';
import { anunciarVoz, desbloquearAudio, tocarBeep } from '@/lib/audio-marcador';
import {
  AVISOS_CATALOGO,
  BEEP_OPCIONES,
  configAvisos,
  etiquetaSeg,
  textoAviso,
} from '@/lib/cronometro-avisos';
import type { Marcador } from '@/lib/types';

// 9 es útil con packs de voz: el aviso de 10 s ya dice "faltan diez segundos",
// así que la cuenta hablada arranca en nueve y no se repite el diez.
const CUENTA_OPCIONES = [0, 3, 5, 9, 10, 15, 20];

type PaqueteMin = { id: string; nombre: string };

export function AvisosCronometro({ m }: { m: Marcador }) {
  const cfg = configAvisos(m);
  const [avisos, setAvisos] = useState<number[]>(cfg.avisos);
  const [repetir, setRepetir] = useState<number>(cfg.repetir);
  const [beep, setBeep] = useState<number>(cfg.beepDesde);
  const [cuenta, setCuenta] = useState<number>(cfg.cuentaVozDesde);

  // Packs de voz disponibles (SQL 37). Lectura pública por RLS, así que el
  // selector funciona igual desde el visor que desde el panel de control.
  const [paquetes, setPaquetes] = useState<PaqueteMin[]>([]);
  const [paquete, setPaquete] = useState<string>(m.voz_paquete_id ?? '');
  useEffect(() => {
    createClient()
      .from('voces_paquetes')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setPaquetes((data as PaqueteMin[] | null) ?? []));
  }, []);

  // Re-sincroniza solo si CAMBIÓ la config (clave serializada), ajustando el
  // estado durante el render como recomienda React. Sin la clave, cualquier
  // UPDATE del reloj trae un array nuevo por identidad y borraría los
  // checkboxes que el operador aún no guardó.
  const claveCfg = JSON.stringify([
    m.avisos_seg, m.avisos_repetir, m.beep_desde_seg, m.voz_cuenta_desde,
    m.voz_paquete_id,
  ]);
  const [claveVista, setClaveVista] = useState(claveCfg);
  if (claveVista !== claveCfg) {
    setClaveVista(claveCfg);
    setAvisos(cfg.avisos);
    setRepetir(cfg.repetir);
    setBeep(cfg.beepDesde);
    setCuenta(cfg.cuentaVozDesde);
    setPaquete(m.voz_paquete_id ?? '');
  }

  function alternar(seg: number) {
    setAvisos((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg].sort((a, b) => b - a),
    );
  }

  // Prueba con el mismo texto y las mismas repeticiones que se oirán en vivo.
  async function probar() {
    await desbloquearAudio();
    const seg = avisos[avisos.length - 1] ?? 60;
    anunciarVoz(textoAviso(seg), { veces: repetir });
    if (beep > 0) setTimeout(() => tocarBeep(0.3, 1200), 400);
  }

  return (
    <form action={actualizarAvisos} className="space-y-3">
      <input type="hidden" name="id" value={m.id} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-tenue">Avisos de voz</p>
        <button
          type="button"
          onClick={probar}
          className="rounded-full bg-white/5 ring-1 ring-white/15 text-zinc-200 px-3 py-1 text-xs hover:bg-white/10"
        >
          🔈 Probar
        </button>
      </div>

      {/* Hitos: chips-checkbox. El name se repite y el action lee getAll(). */}
      <div className="flex flex-wrap gap-1.5">
        {AVISOS_CATALOGO.map((seg) => {
          const on = avisos.includes(seg);
          return (
            <label
              key={seg}
              className={`cursor-pointer select-none rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                on
                  ? 'bg-orange-600/30 ring-orange-400/60 text-orange-100'
                  : 'bg-black/30 ring-white/10 text-zinc-400 hover:bg-black/50'
              }`}
            >
              <input
                type="checkbox"
                name="avisos_seg"
                value={seg}
                checked={on}
                onChange={() => alternar(seg)}
                className="sr-only"
              />
              {etiquetaSeg(seg)}
            </label>
          );
        })}
      </div>
      <p className="text-[0.7rem] text-tenue">
        {avisos.length
          ? `Dirá "${textoAviso(avisos[0])}" al cruzar cada hito.`
          : 'Sin avisos de voz: solo beep y bocina final.'}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[0.7rem] text-tenue mb-1 uppercase tracking-widest">
            Repetir aviso
          </label>
          <select
            name="avisos_repetir"
            value={repetir}
            onChange={(e) => setRepetir(parseInt(e.target.value, 10))}
            className="border border-borde rounded-lg px-2 py-2 bg-campo text-texto w-full text-sm"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1 vez' : `${n} veces`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[0.7rem] text-tenue mb-1 uppercase tracking-widest">
            Beep desde
          </label>
          <select
            name="beep_desde_seg"
            value={beep}
            onChange={(e) => setBeep(parseInt(e.target.value, 10))}
            className="border border-borde rounded-lg px-2 py-2 bg-campo text-texto w-full text-sm"
          >
            {BEEP_OPCIONES.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Sin beep' : `${n} s`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[0.7rem] text-tenue mb-1 uppercase tracking-widest">
            Cuenta hablada
          </label>
          <select
            name="voz_cuenta_desde"
            value={cuenta}
            onChange={(e) => setCuenta(parseInt(e.target.value, 10))}
            className="border border-borde rounded-lg px-2 py-2 bg-campo text-texto w-full text-sm"
          >
            {CUENTA_OPCIONES.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'No' : `Últimos ${n} s`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[0.7rem] text-tenue">
        El beep suena una vez por segundo desde ese valor hasta 1 (los últimos 5
        más agudos). La bocina larga suena al llegar a 0.
      </p>

      <div>
        <label className="block text-[0.7rem] text-tenue mb-1 uppercase tracking-widest">
          Voz de los avisos
        </label>
        <select
          name="voz_paquete_id"
          value={paquete}
          onChange={(e) => setPaquete(e.target.value)}
          className="border border-borde rounded-lg px-2 py-2 bg-campo text-texto w-full text-sm"
        >
          <option value="">Voz del sistema (sintetizada)</option>
          {paquetes.map((p) => (
            <option key={p.id} value={p.id}>
              🎭 {p.nombre}
            </option>
          ))}
        </select>
        <p className="text-[0.7rem] text-tenue mt-1">
          Los avisos sin audio en el pack caen a la voz del sistema.{' '}
          <Link href="/admin/voces" className="text-orange-400 hover:underline">
            Gestionar packs
          </Link>
        </p>
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold h-11 px-4 text-sm transition active:scale-[0.97]"
      >
        Guardar avisos
      </button>
    </form>
  );
}
