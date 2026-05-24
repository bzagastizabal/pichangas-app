// src/app/inscribir/[slug]/FormComprobante.tsx
// Formulario para subir el comprobante de pago (Yape/Plin/banco) de una
// inscripción pendiente. Sube el archivo a Storage y registra el pago.
'use client';

import { useActionState } from 'react';
import { subirComprobante } from './actions';

const input = 'border border-gray-300 p-2 w-full rounded';

export function FormComprobante({
  inscripcionId,
  montoSugerido,
}: {
  inscripcionId: string;
  montoSugerido: number;
}) {
  const [estado, formAction, pending] = useActionState(subirComprobante, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="inscripcion_id" value={inscripcionId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="metodo">
          Método de pago
        </label>
        <select id="metodo" name="metodo" className={input} defaultValue="yape">
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="banco">Transferencia bancaria</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="monto_declarado">
          Monto pagado (S/)
        </label>
        <input
          id="monto_declarado"
          name="monto_declarado"
          type="number"
          min="0"
          step="0.01"
          className={input}
          defaultValue={montoSugerido}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="comprobante">
          Comprobante (imagen o PDF, máx. 5 MB)
        </label>
        <input
          id="comprobante"
          name="comprobante"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm"
          required
        />
      </div>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-600 text-white py-2 rounded font-medium disabled:opacity-50"
      >
        {pending ? 'Subiendo…' : 'Enviar comprobante'}
      </button>
    </form>
  );
}
