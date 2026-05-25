'use client';

import { useState } from 'react';
import { linkWa } from '@/lib/wa';

// Botones para copiar / abrir / compartir por WhatsApp un enlace, sin exponer
// la URL cruda. Si se pasa waMensaje, muestra el botón de WhatsApp.
export function CompartirEnlace({
  url,
  etiqueta = 'Enlace',
  waTelefono,
  waMensaje,
}: {
  url: string;
  etiqueta?: string;
  waTelefono?: string | null;
  waMensaje?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  }

  const btn = 'rounded border border-borde px-2 py-1 text-xs hover:border-orange-500';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-tenue">{etiqueta}:</span>
      <button type="button" onClick={copiar} className={btn}>
        {copiado ? 'Copiado ✓' : 'Copiar'}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className={btn}>
        Abrir
      </a>
      {waMensaje && (
        <a
          href={linkWa(waTelefono, waMensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-green-600/40 px-2 py-1 text-xs text-green-400 hover:border-green-500"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}
