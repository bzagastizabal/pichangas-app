// src/app/admin/movimientos/page.tsx
// Lista de movimientos independientes (ingresos/egresos extra al evento) con
// filtros por tipo/estado/fecha, totales aprobados y acciones de aprobar/rechazar.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatearFechaLima } from '@/lib/fechas';
import {
  ETIQUETA_CATEGORIA,
  type EstadoMovimiento,
  type Movimiento,
  type TipoMovimiento,
} from '@/lib/types';
import { aprobarMovimiento, eliminarMovimiento, rechazarMovimiento } from './actions';
import { VerSustento } from './VerSustento';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

const colorEstado: Record<EstadoMovimiento, string> = {
  pendiente: 'text-amber-400',
  aprobado: 'text-green-400',
  rechazado: 'text-red-400',
};

const colorTipo: Record<TipoMovimiento, string> = {
  ingreso: 'text-green-400',
  egreso: 'text-red-400',
};

type Fila = Movimiento & {
  perfil_creado: { nombre_completo: string | null } | null;
  perfil_aprobado: { nombre_completo: string | null } | null;
};

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    estado?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const { tipo, estado, desde, hasta } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from('movimientos')
    .select(
      'id, tipo, categoria, monto, descripcion, fecha, evento_id, url_sustento, estado, creado_por, aprobado_por, fecha_aprobado, motivo_rechazo, created_at, perfil_creado:perfiles!creado_por(nombre_completo), perfil_aprobado:perfiles!aprobado_por(nombre_completo)',
    )
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (tipo === 'ingreso' || tipo === 'egreso') q = q.eq('tipo', tipo);
  if (estado === 'pendiente' || estado === 'aprobado' || estado === 'rechazado') {
    q = q.eq('estado', estado);
  }
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);

  const { data } = await q;
  const filas = (data as unknown as Fila[]) ?? [];

  // Totales SOLO de los aprobados visibles tras filtros (el balance "real" del rango).
  const tot = filas
    .filter((m) => m.estado === 'aprobado')
    .reduce(
      (a, m) => {
        if (m.tipo === 'ingreso') a.ingresos += Number(m.monto);
        else a.egresos += Number(m.monto);
        return a;
      },
      { ingresos: 0, egresos: 0 },
    );
  const balance = tot.ingresos - tot.egresos;
  const pendientes = filas.filter((m) => m.estado === 'pendiente').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Movimientos</h1>
        <Link
          href="/admin/movimientos/nuevo"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          + Nuevo movimiento
        </Link>
      </div>

      <p className="text-sm text-tenue">
        Ingresos (donaciones, premios, aportes, saldos) y egresos (compras,
        gastos, pagos) <strong>independientes</strong> a los costos de cada evento.
        Cada movimiento requiere sustento y aprobación de un admin.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="block text-tenue mb-1">Tipo</span>
          <select name="tipo" defaultValue={tipo ?? ''} className="border border-borde rounded px-2 py-1 bg-campo text-texto">
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </label>
        <label>
          <span className="block text-tenue mb-1">Estado</span>
          <select name="estado" defaultValue={estado ?? ''} className="border border-borde rounded px-2 py-1 bg-campo text-texto">
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </label>
        <label>
          <span className="block text-tenue mb-1">Desde</span>
          <input type="date" name="desde" defaultValue={desde ?? ''} className="border border-borde rounded px-2 py-1 bg-campo text-texto" />
        </label>
        <label>
          <span className="block text-tenue mb-1">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta ?? ''} className="border border-borde rounded px-2 py-1 bg-campo text-texto" />
        </label>
        <button type="submit" className="bg-orange-600 text-white px-4 py-1.5 rounded">
          Filtrar
        </button>
        {(tipo || estado || desde || hasta) && (
          <Link href="/admin/movimientos" className="text-tenue hover:underline">
            Limpiar
          </Link>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen titulo="Ingresos aprobados" valor={soles.format(tot.ingresos)} color="text-green-400" />
        <Resumen titulo="Egresos aprobados" valor={soles.format(tot.egresos)} color="text-red-400" />
        <Resumen titulo="Balance" valor={soles.format(balance)} color={balance >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Resumen titulo="Pendientes" valor={String(pendientes)} color="text-amber-400" />
      </div>

      {filas.length === 0 ? (
        <p className="text-tenue">No hay movimientos con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full text-sm">
            <thead className="bg-fondo text-left text-tenue">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Descripción</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Sustento</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.id} className="border-t border-borde align-top">
                  <td className="p-3 text-tenue whitespace-nowrap">
                    {formatearFechaLima(m.fecha)}
                  </td>
                  <td className={`p-3 ${colorTipo[m.tipo]}`}>
                    {m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                  </td>
                  <td className="p-3 text-tenue">{ETIQUETA_CATEGORIA[m.categoria]}</td>
                  <td className="p-3">
                    {m.descripcion}
                    <div className="text-xs text-tenue">
                      Por: {m.perfil_creado?.nombre_completo ?? '—'}
                      {m.estado === 'aprobado' && m.perfil_aprobado?.nombre_completo && (
                        <> · Aprobó: {m.perfil_aprobado.nombre_completo}</>
                      )}
                      {m.estado === 'rechazado' && m.motivo_rechazo && (
                        <> · Motivo: {m.motivo_rechazo}</>
                      )}
                    </div>
                  </td>
                  <td className={`p-3 text-right font-medium ${colorTipo[m.tipo]}`}>
                    {m.tipo === 'ingreso' ? '+' : '−'} {soles.format(Number(m.monto))}
                  </td>
                  <td className={`p-3 ${colorEstado[m.estado]}`}>
                    {m.estado}
                  </td>
                  <td className="p-3">
                    <VerSustento path={m.url_sustento} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {m.estado === 'pendiente' && (
                        <>
                          <form action={aprobarMovimiento}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                              Aprobar
                            </button>
                          </form>
                          <form action={rechazarMovimiento} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={m.id} />
                            <input
                              name="motivo"
                              placeholder="Motivo"
                              className="border border-borde rounded px-1 py-0.5 bg-campo text-xs w-24"
                            />
                            <button type="submit" className="rounded border border-borde px-2 py-1 text-xs">
                              Rechazar
                            </button>
                          </form>
                        </>
                      )}
                      <form action={eliminarMovimiento}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="text-xs text-tenue hover:text-red-400"
                          title="Eliminar movimiento"
                        >
                          🗑️
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Resumen({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg border border-borde p-4">
      <p className="text-sm text-tenue">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
