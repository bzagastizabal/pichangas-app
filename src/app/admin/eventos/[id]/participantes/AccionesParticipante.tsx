'use client';

import { useState } from 'react';
import { aprobarPago } from '@/app/admin/pagos/actions';
import { CompartirEnlace } from '@/app/admin/CompartirEnlace';
import { BotonSubmit } from '@/components/BotonSubmit';
import { quitarParticipante } from './actions';
import { FormPagoAdmin } from './FormPagoAdmin';
import { FormAprobarManual } from './FormAprobarManual';

const btn = 'text-xs rounded border border-borde px-2 py-1 hover:border-orange-500';

export function AccionesParticipante({
  inscripcionId,
  usuarioId,
  nombre,
  telefono,
  linkPago,
  waMensaje,
  montoSugerido,
  pagoEnRevisionId,
  tienePagoVivo,
}: {
  inscripcionId: string;
  usuarioId: string;
  nombre: string;
  telefono?: string | null;
  linkPago: string;
  waMensaje: string;
  montoSugerido: number;
  pagoEnRevisionId: string | null;
  tienePagoVivo: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [modalManual, setModalManual] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      {pagoEnRevisionId && (
        <form action={aprobarPago}>
          <input type="hidden" name="id" value={pagoEnRevisionId} />
          <BotonSubmit
            className="text-xs rounded bg-green-600 px-2 py-1 text-white"
            pendiente="Aprobando…"
          >
            Aprobar
          </BotonSubmit>
        </form>
      )}

      {!tienePagoVivo && (
        <>
          <button type="button" className={btn} onClick={() => setModal(true)}>
            Subir pago
          </button>
          <button
            type="button"
            className="text-xs rounded border border-green-500/40 text-green-300 px-2 py-1 hover:border-green-400"
            onClick={() => setModalManual(true)}
            title="Aprobar sin captura (pago en efectivo, etc.)"
          >
            Marcar pagado
          </button>
        </>
      )}

      <div className="relative">
        <button type="button" className={btn} onClick={() => setMenu((m) => !m)}>
          Invitar ▾
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-20 mt-1 rounded-lg border border-borde bg-tarjeta p-3 shadow-lg">
              <CompartirEnlace
                url={linkPago}
                etiqueta="Link de pago"
                waTelefono={telefono}
                waMensaje={waMensaje}
              />
            </div>
          </>
        )}
      </div>

      <form
        action={quitarParticipante}
        onSubmit={(e) => {
          if (!confirm(`¿Quitar a "${nombre}" del evento?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={inscripcionId} />
        <button type="submit" className="text-xs text-red-400 hover:underline">
          Quitar
        </button>
      </form>

      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative z-50 w-full max-w-md space-y-3 rounded-xl border border-borde bg-tarjeta p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Subir pago de {nombre}</h3>
              <button type="button" onClick={() => setModal(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <FormPagoAdmin
              inscripcionId={inscripcionId}
              usuarioId={usuarioId}
              montoSugerido={montoSugerido}
            />
          </div>
        </div>
      )}

      {modalManual && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalManual(false)} />
          <div className="relative z-50 w-full max-w-md space-y-3 rounded-xl border border-borde bg-tarjeta p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Marcar como pagado: {nombre}</h3>
              <button type="button" onClick={() => setModalManual(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <FormAprobarManual
              inscripcionId={inscripcionId}
              montoSugerido={montoSugerido}
            />
          </div>
        </div>
      )}
    </div>
  );
}
