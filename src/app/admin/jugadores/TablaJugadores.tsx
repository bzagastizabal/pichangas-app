// Tabla de jugadores con buscador instantáneo (nombre, DNI o teléfono) y
// filtro por estado. El orden por columna sigue siendo via URL (server).
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { linkWa } from '@/lib/wa';
import { BotonReiniciar } from './BotonReiniciar';
import { alternarActivoJugador } from './actions';

export type FilaJugador = {
  id: string;
  nombre_completo: string | null;
  dni: string | null;
  telefono: string | null;
  nacionalidad: string | null;
  rol: 'participante' | 'administrador';
  activo: boolean;
  edad: number | null;
};

type Orden = 'nombre' | 'edad' | 'dni' | 'nacionalidad';
type Dir = 'asc' | 'desc';
type EstadoFiltro = 'todos' | 'activos' | 'baja';

// Quita acentos y pasa a minúsculas para comparación tolerante.
function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function TablaJugadores({
  filas,
  ordenarPor,
  direccion,
}: {
  filas: FilaJugador[];
  ordenarPor: Orden;
  direccion: Dir;
}) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<EstadoFiltro>('todos');

  const filtradas = useMemo(() => {
    const qN = norm(q.trim());
    return filas.filter((f) => {
      if (estado === 'activos' && !f.activo) return false;
      if (estado === 'baja' && f.activo) return false;
      if (!qN) return true;
      return (
        norm(f.nombre_completo).includes(qN) ||
        norm(f.dni).includes(qN) ||
        norm(f.telefono).includes(qN)
      );
    });
  }, [filas, q, estado]);

  const cabecera = (col: Orden, label: string) => {
    const next = ordenarPor === col && direccion === 'asc' ? 'desc' : 'asc';
    const flecha = ordenarPor === col ? (direccion === 'asc' ? ' ▲' : ' ▼') : '';
    return (
      <Link
        href={`/admin/jugadores?sort=${col}&dir=${next}`}
        className="hover:text-texto"
        scroll={false}
      >
        {label}
        {flecha}
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borde p-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, DNI o teléfono…"
            className="w-full rounded-lg border border-borde bg-campo px-3 py-2 pl-9 text-sm text-texto placeholder:text-tenue"
            aria-label="Buscar jugador"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
            🔍
          </span>
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-tenue hover:text-texto"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
          className="rounded-lg border border-borde bg-campo px-3 py-2 text-sm text-texto"
          aria-label="Filtrar por estado"
        >
          <option value="todos">Todos</option>
          <option value="activos">Solo activos</option>
          <option value="baja">Solo de baja</option>
        </select>
        <p className="text-sm text-tenue">
          <strong className="text-texto">{filtradas.length}</strong> de {filas.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">{cabecera('nombre', 'Nombre')}</th>
              <th className="p-3">{cabecera('dni', 'DNI')}</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">{cabecera('edad', 'Edad')}</th>
              <th className="p-3">{cabecera('nacionalidad', 'Nacionalidad')}</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => (
              <tr
                key={p.id}
                className={`border-t border-borde ${p.activo ? '' : 'opacity-50'}`}
              >
                <td className="p-3">{p.nombre_completo ?? '—'}</td>
                <td className="p-3 text-tenue">{p.dni ?? '—'}</td>
                <td className="p-3 text-tenue">
                  {p.telefono ? (
                    <a
                      href={linkWa(
                        p.telefono,
                        `Hola ${p.nombre_completo ?? ''}, te escribo desde el CMT.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:underline"
                    >
                      {p.telefono}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3 text-tenue">{p.edad ?? '—'}</td>
                <td className="p-3 text-tenue">{p.nacionalidad ?? '—'}</td>
                <td className="p-3 text-tenue">{p.rol}</td>
                <td className="p-3">
                  {p.activo ? (
                    <span className="text-green-400">activo</span>
                  ) : (
                    <span className="text-tenue">de baja</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/jugadores/${p.id}/editar`}
                      className="text-orange-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <BotonReiniciar
                      id={p.id}
                      nombre={p.nombre_completo ?? 'este jugador'}
                    />
                    <form action={alternarActivoJugador}>
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        type="hidden"
                        name="activo"
                        value={String(p.activo)}
                      />
                      <button
                        type="submit"
                        className="text-tenue hover:underline"
                      >
                        {p.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-tenue">
                  {filas.length === 0
                    ? 'Aún no hay jugadores.'
                    : 'Sin resultados con esos filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
