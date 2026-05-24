'use client';

import { useActionState } from 'react';
import { subirVoucherPorToken } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export function FormVoucher({ token, montoSugerido }: { token: string; montoSugerido: number }) {
  const [estado, formAction, pending] = useActionState(subirVoucherPorToken, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="block text-sm text-tenue mb-1">Método de pago</label>
        <select name="metodo" defaultValue="yape" className={input}>
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="banco">Transferencia bancaria</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-tenue mb-1">Monto pagado (S/)</label>
        <input name="monto_declarado" type="number" min="0" step="0.01" defaultValue={montoSugerido} className={input} />
      </div>
      <div>
        <label className="block text-sm text-tenue mb-1">Comprobante (foto o PDF)</label>
        <input
          name="comprobante"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm"
          required
        />
      </div>
      {estado.error && <p className="text-sm text-red-500">{estado.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-600 text-white py-2 rounded font-medium disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Enviar comprobante'}
      </button>
    </form>
  );
}
