// Form para marcar un pago como aprobado SIN subir captura. Útil cuando el
// jugador pagó en efectivo o el pago ya se verificó por otra vía. Solo admin.
'use client';

import { useActionState } from 'react';
import { aprobarPagoManual } from './actions';

const input = 'border border-borde p-1.5 rounded bg-campo text-texto text-sm';

export function FormAprobarManual({
  inscripcionId,
  montoSugerido,
}: {
  inscripcionId: string;
  montoSugerido: number;
}) {
  const [estado, formAction, pending] = useActionState(aprobarPagoManual, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="inscripcion_id" value={inscripcionId} />

      <p className="text-xs text-tenue">
        Se registrará un pago <strong>aprobado</strong> sin captura. Útil para
        pagos en efectivo o ya verificados por otro medio.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-tenue">Método</label>
        <select name="metodo" defaultValue="efectivo" className={input}>
          <option value="efectivo">Efectivo</option>
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="banco">Banco</option>
        </select>
        <label className="text-xs text-tenue">Monto</label>
        <input
          name="monto_declarado"
          type="number"
          min="0"
          step="0.01"
          defaultValue={montoSugerido}
          className={`${input} w-24`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
      >
        {pending ? 'Aprobando…' : 'Aprobar sin captura'}
      </button>
      {estado.error && <p className="text-xs text-red-500">{estado.error}</p>}
    </form>
  );
}
