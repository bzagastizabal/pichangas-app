// Form de importación + visor de resultados (creados/actualizados/errores).
// 'Solo validar' hace dry-run para previsualizar sin escribir nada.
'use client';

import { useActionState } from 'react';
import {
  importarJugadoresCSV,
  type ImportEstado,
  type ImportResultado,
} from './actions';

function esResultado(e: ImportEstado): e is ImportResultado {
  return !!e && 'total' in e;
}

export function FormImportar() {
  const inicial: ImportEstado = null;
  const [estado, formAction, pending] = useActionState(
    importarJugadoresCSV,
    inicial,
  );

  return (
    <div className="space-y-4">
      <form
        action={formAction}
        encType="multipart/form-data"
        className="space-y-3 rounded-lg border border-borde p-4 bg-tarjeta/40"
      >
        <div>
          <label className="block text-xs text-tenue mb-1">Archivo CSV *</label>
          <input
            name="archivo"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm"
          />
          <p className="mt-1 text-xs text-tenue">
            Separador <code>,</code> o <code>;</code> (Excel ES). Máximo 2 MB.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="dry_run" defaultChecked />
          Solo validar (no aplicar cambios)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Procesando…' : 'Subir CSV'}
        </button>
      </form>

      {estado && 'error' in estado && (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {estado.error}
        </p>
      )}

      {esResultado(estado) && (
        <div className="space-y-3">
          {estado.dryRun && (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              Vista previa (dry-run). No se ha modificado nada. Destildá "Solo
              validar" y vuelve a subir el mismo archivo para aplicar.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <Card titulo="Filas" valor={String(estado.total)} color="text-zinc-200" />
            <Card titulo="A crear" valor={String(estado.creados)} color="text-green-400" />
            <Card titulo="A actualizar" valor={String(estado.actualizados)} color="text-sky-400" />
            <Card titulo="Errores" valor={String(estado.errores.length)} color={estado.errores.length ? 'text-red-400' : 'text-zinc-400'} />
          </div>

          {estado.errores.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full text-sm">
                <thead className="bg-fondo text-left text-tenue">
                  <tr>
                    <th className="p-3">Línea</th>
                    <th className="p-3">DNI</th>
                    <th className="p-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.errores.slice(0, 50).map((e, i) => (
                    <tr key={i} className="border-t border-borde">
                      <td className="p-3 text-tenue">{e.linea}</td>
                      <td className="p-3">{e.dni || '—'}</td>
                      <td className="p-3 text-red-300">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {estado.errores.length > 50 && (
                <p className="p-2 text-xs text-tenue">
                  …mostrando los primeros 50 de {estado.errores.length} errores.
                </p>
              )}
            </div>
          )}

          {!estado.dryRun && estado.errores.length === 0 && (
            <p className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
              ¡Listo! {estado.creados} creados, {estado.actualizados} actualizados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg border border-borde p-3">
      <p className="text-xs text-tenue uppercase tracking-wide">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
