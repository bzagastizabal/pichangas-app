'use client';

import { useActionState } from 'react';
import { subirComprobanteAdmin } from './actions';

const input = 'border border-borde p-1.5 rounded bg-campo text-texto text-sm';

export function FormPagoAdmin({
  inscripcionId,
  usuarioId,
  montoSugerido,
}: {
  inscripcionId: string;
  usuarioId: string;
  montoSugerido: number;
}) {
  const [estado, formAction, pending] = useActionState(subirComprobanteAdmin, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inscripcion_id" value={inscripcionId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <select name="metodo" defaultValue="yape" className={input}>
        <option value="yape">Yape</option>
        <option value="plin">Plin</option>
        <option value="banco">Banco</option>
        <option value="efectivo">Efectivo</option>
      </select>
      <input
        name="monto_declarado"
        type="number"
        min="0"
        step="0.01"
        defaultValue={montoSugerido}
        className={`${input} w-24`}
      />
      <input
        name="comprobante"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="text-xs"
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
      >
        {pending ? 'Subiendo…' : 'Subir pago'}
      </button>
      {estado.error && <span className="text-xs text-red-500">{estado.error}</span>}
    </form>
  );
}
