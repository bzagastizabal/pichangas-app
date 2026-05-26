// Botón cliente que pide una URL firmada al servidor y abre el sustento en
// una pestaña nueva. Las URLs firman/expiran en 5 min: no se exponen en HTML.
'use client';

import { useState } from 'react';
import { urlSustento } from './actions';

export function VerSustento({ path }: { path: string }) {
  const [cargando, setCargando] = useState(false);

  async function abrir() {
    setCargando(true);
    const u = await urlSustento(path);
    setCargando(false);
    if (u) window.open(u, '_blank', 'noopener');
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={cargando}
      className="text-orange-400 hover:underline text-xs disabled:opacity-50"
    >
      {cargando ? '…' : 'Ver sustento'}
    </button>
  );
}
