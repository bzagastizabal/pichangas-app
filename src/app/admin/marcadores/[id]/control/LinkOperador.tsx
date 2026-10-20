// Link público de operador (SQL 39): habilita SOLO los controles de tiempo
// (play/pausa, ±segundos, reset y bocina) para quien toma el tiempo en la
// cancha, sin darle sesión ni acceso a colores, avisos o duración total.
'use client';

import { useState } from 'react';
import { regenerarClaveOperador } from './actions';

export function LinkOperador({ id, url }: { id: string; url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <div className="rounded-2xl bg-tarjeta/70 backdrop-blur ring-1 ring-white/10 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-tenue">
          🕹️ Link de operador (sin cuenta)
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copiar}
            className={`rounded px-3 py-1.5 text-xs font-bold text-white transition ${
              copiado ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-500'
            }`}
          >
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
          <form action={regenerarClaveOperador}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              title="Genera un link nuevo; el anterior deja de funcionar"
              className="rounded px-3 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/15 hover:bg-white/5"
            >
              ↻ Regenerar
            </button>
          </form>
        </div>
      </div>
      <p className="break-all rounded-lg bg-black/40 ring-1 ring-white/5 p-2 text-[0.7rem] font-mono text-zinc-300">
        {url}
      </p>
      <p className="text-[0.7rem] text-tenue">
        Quien abra este link ve el cronómetro y puede dar play/pausa, ±10 y ±30 s,
        reset y bocina. No puede cambiar colores, avisos, voz ni el tiempo total.
        Compártelo solo con quien toma el tiempo.
      </p>
    </div>
  );
}
