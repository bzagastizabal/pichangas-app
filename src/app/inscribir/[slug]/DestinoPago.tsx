// Card que muestra a quien Yapean/Plinean los jugadores. Aparece cerca del
// formulario de comprobante (estado pendiente sin pago).
'use client';

import { useState } from 'react';
import { linkWa } from '@/lib/wa';

export function DestinoPago({
  titular,
  telefono,
  monto,
}: {
  titular: string | null;
  telefono: string | null;
  monto: number;
}) {
  const [copiado, setCopiado] = useState<'tel' | 'monto' | null>(null);

  if (!telefono) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="text-amber-800">
          ℹ️ Antes de yapear pregúntale al staff a qué número enviar.
        </p>
      </div>
    );
  }

  function copiar(valor: string, tipo: 'tel' | 'monto') {
    void navigator.clipboard.writeText(valor).then(() => {
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 1500);
    });
  }

  const mensajeWa =
    `Hola${titular ? ' ' + titular : ''}, te envío mi Yape/Plin por la pichanga. Monto: S/ ${monto}.`;

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm space-y-2">
      <p className="text-xs uppercase tracking-widest text-green-700/80">
        Yapea o Plinea a
      </p>
      {titular && (
        <p className="text-lg font-bold text-green-900">{titular}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xl font-mono font-semibold text-green-900 tracking-wider">
          {telefono}
        </span>
        <button
          type="button"
          onClick={() => copiar(telefono, 'tel')}
          className="rounded border border-green-700/40 bg-white px-2 py-0.5 text-xs text-green-800 hover:bg-green-100"
        >
          {copiado === 'tel' ? '✓ copiado' : 'copiar'}
        </button>
      </div>
      <div className="flex items-center gap-2 text-green-800">
        <span>Monto: <strong className="font-mono">S/ {monto}</strong></span>
        <button
          type="button"
          onClick={() => copiar(String(monto), 'monto')}
          className="rounded border border-green-700/40 bg-white px-2 py-0.5 text-xs text-green-800 hover:bg-green-100"
        >
          {copiado === 'monto' ? '✓ copiado' : 'copiar'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={linkWa(telefono, mensajeWa)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-green-600 text-white text-xs px-3 py-1.5 hover:bg-green-500"
        >
          Abrir WhatsApp
        </a>
      </div>
      <p className="text-xs text-green-700/80">
        Después de yapear/plinear, sube tu comprobante aquí abajo.
      </p>
    </div>
  );
}
