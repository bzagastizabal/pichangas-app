// src/app/admin/eventos/EventoForm.tsx
// Formulario compartido para crear y editar eventos.
// - Duración en pasos de media hora (1, 1.5, 2…).
// - costo_sede y costo_arbitraje se IMPORTAN automáticamente como
//   precio_por_hora × duración al elegir sede/árbitro o cambiar la duración,
//   pero el admin puede ajustarlos (costo especial puntual).
// - Muestra en vivo el costo por participante.
'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  calcularCostoPorParticipante,
  costoArbitroTramo,
  type EstadoForm,
  type Evento,
  type TarifasArbitro,
} from '@/lib/types';
import { isoADatetimeLocalLima } from '@/lib/fechas';
import { Pista } from '@/components/Pista';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

type Opcion = { id: string; nombre: string; precio_por_hora: number };
type OpcionArbitro = { id: string; nombre: string } & TarifasArbitro;

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EventoForm({
  action,
  sedes,
  arbitros,
  arbitrosSeleccionados,
  categorias,
  inicial,
  esCopia = false,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  sedes: Opcion[];
  arbitros: OpcionArbitro[];
  arbitrosSeleccionados: string[];
  categorias: { id: string; nombre: string }[];
  inicial?: Evento;
  // En modo copia tomamos toda la config de `inicial` pero creamos un evento
  // nuevo: sin id (no edita) y con fechas en blanco (se eligen de nuevo).
  esCopia?: boolean;
}) {
  const [estado, formAction, pending] = useActionState(action, {});

  const [sedeId, setSedeId] = useState(inicial?.sede_id ?? '');
  const [arbitroIds, setArbitroIds] = useState<string[]>(arbitrosSeleccionados);
  const [duracion, setDuracion] = useState(inicial?.duracion_horas ?? 2);
  const [costoSede, setCostoSede] = useState(inicial?.costo_sede ?? 0);
  const [costoArbitraje, setCostoArbitraje] = useState(inicial?.costo_arbitraje ?? 0);
  const [porcentaje, setPorcentaje] = useState(inicial?.porcentaje_ganancia ?? 0);
  const [cupos, setCupos] = useState(inicial?.cupos_totales ?? 20);

  const precioDe = (id: string, lista: Opcion[]) =>
    lista.find((x) => x.id === id)?.precio_por_hora ?? 0;

  // Suma del costo de los árbitros seleccionados según la duración (por tramos).
  function sumaArbitros(ids: string[], d: number) {
    return round2(
      ids.reduce((acc, id) => {
        const a = arbitros.find((x) => x.id === id);
        return acc + (a ? costoArbitroTramo(a, d) : 0);
      }, 0),
    );
  }

  function alCambiarSede(id: string) {
    setSedeId(id);
    setCostoSede(round2(precioDe(id, sedes) * duracion));
  }

  function alternarArbitro(id: string) {
    const nuevos = arbitroIds.includes(id)
      ? arbitroIds.filter((x) => x !== id)
      : [...arbitroIds, id];
    setArbitroIds(nuevos);
    setCostoArbitraje(sumaArbitros(nuevos, duracion));
  }

  function alCambiarDuracion(d: number) {
    setDuracion(d);
    setCostoSede(round2(precioDe(sedeId, sedes) * d));
    setCostoArbitraje(sumaArbitros(arbitroIds, d));
  }

  const costoPorParticipante = calcularCostoPorParticipante(
    Number(costoSede),
    Number(costoArbitraje),
    Number(porcentaje),
    Number(cupos),
  );

  // Estimación asumiendo que el evento se llena (todos los cupos).
  const egresosTotales = round2(Number(costoSede) + Number(costoArbitraje));
  const recaudacionTotal = round2(costoPorParticipante * Number(cupos));
  const gananciaTotal = round2(recaudacionTotal - egresosTotales);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      {inicial && !esCopia && <input type="hidden" name="id" value={inicial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="tipo">
            Tipo de evento
          </label>
          <select
            id="tipo"
            name="tipo"
            className={input}
            defaultValue={inicial?.tipo ?? 'pichanga'}
          >
            <option value="pichanga">Pichanga</option>
            <option value="amistoso">Amistoso</option>
            <option value="torneo">Torneo</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="categoria_id">
            Categoría
          </label>
          <select
            id="categoria_id"
            name="categoria_id"
            className={input}
            defaultValue={inicial?.categoria_id ?? ''}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="sede_id">
            Sede *
          </label>
          <select
            id="sede_id"
            name="sede_id"
            className={input}
            value={sedeId}
            onChange={(e) => alCambiarSede(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige una sede…
            </option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} — {soles.format(s.precio_por_hora)}/h
              </option>
            ))}
          </select>
          {sedes.length === 0 && (
            <p className="mt-1 text-xs text-red-600">
              No hay sedes activas. Crea una en “Sedes” primero.
            </p>
          )}
        </div>

        <div>
          <label className={label}>
            Árbitros (uno o varios)
            <Pista texto="Puedes asignar más de un árbitro para cotizar el gasto total. El costo de cada uno depende de la duración (tarifa por tramo)." />
          </label>
          <div className="border border-borde rounded bg-campo p-2 space-y-1 max-h-44 overflow-y-auto">
            {arbitros.length === 0 && (
              <p className="text-xs text-tenue">No hay árbitros activos.</p>
            )}
            {arbitros.map((a) => (
              <label
                key={a.id}
                className="flex items-center justify-between gap-2 text-sm text-texto"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="arbitros"
                    value={a.id}
                    checked={arbitroIds.includes(a.id)}
                    onChange={() => alternarArbitro(a.id)}
                  />
                  {a.nombre}
                </span>
                <span className="text-tenue">
                  {soles.format(costoArbitroTramo(a, duracion))}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={label} htmlFor="fecha_hora_evento">
            Fecha y hora del evento *
          </label>
          <input
            id="fecha_hora_evento"
            name="fecha_hora_evento"
            type="datetime-local"
            className={input}
            defaultValue={
              inicial && !esCopia
                ? isoADatetimeLocalLima(inicial.fecha_hora_evento)
                : ''
            }
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="fecha_hora_limite_pago">
            Límite de pago *
          </label>
          <input
            id="fecha_hora_limite_pago"
            name="fecha_hora_limite_pago"
            type="datetime-local"
            className={input}
            defaultValue={
              inicial && !esCopia
                ? isoADatetimeLocalLima(inicial.fecha_hora_limite_pago)
                : ''
            }
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="duracion_horas">
            Duración (horas) *
          </label>
          <input
            id="duracion_horas"
            name="duracion_horas"
            type="number"
            min="0.5"
            step="0.5"
            className={input}
            value={duracion}
            onChange={(e) => alCambiarDuracion(Number(e.target.value))}
            required
          />
          <p className="mt-1 text-xs text-tenue">
            En pasos de media hora (p. ej. 1.5 = 1 h 30 min).
          </p>
        </div>

        <div>
          <label className={label} htmlFor="cupos_totales">
            Cupos totales *
          </label>
          <input
            id="cupos_totales"
            name="cupos_totales"
            type="number"
            min="1"
            step="1"
            className={input}
            value={cupos}
            onChange={(e) => setCupos(Number(e.target.value))}
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="minimo_requerido">
            Mínimo para confirmar
            <Pista texto="Mínimo de jugadores para que la pichanga se realice. Si no se llega, se cancela." />
          </label>
          <input
            id="minimo_requerido"
            name="minimo_requerido"
            type="number"
            min="0"
            step="1"
            className={input}
            defaultValue={inicial?.minimo_requerido ?? 0}
          />
        </div>

        <div>
          <label className={label} htmlFor="costo_sede">
            Costo de sede (S/)
          </label>
          <input
            id="costo_sede"
            name="costo_sede"
            type="number"
            min="0"
            step="0.01"
            className={input}
            value={costoSede}
            onChange={(e) => setCostoSede(Number(e.target.value))}
          />
        </div>

        <div>
          <label className={label} htmlFor="costo_arbitraje">
            Costo de arbitraje (S/)
          </label>
          <input
            id="costo_arbitraje"
            name="costo_arbitraje"
            type="number"
            min="0"
            step="0.01"
            className={input}
            value={costoArbitraje}
            onChange={(e) => setCostoArbitraje(Number(e.target.value))}
          />
        </div>

        <div>
          <label className={label} htmlFor="porcentaje_ganancia">
            % de ganancia
            <Pista texto="Margen que se suma a (sede + arbitraje) antes de dividir entre los cupos para el costo por jugador." />
          </label>
          <input
            id="porcentaje_ganancia"
            name="porcentaje_ganancia"
            type="number"
            min="0"
            step="0.01"
            className={input}
            value={porcentaje}
            onChange={(e) => setPorcentaje(Number(e.target.value))}
          />
        </div>
      </div>

      <p className="text-xs text-tenue">
        El costo de sede se importa como <strong>precio/hora × duración</strong>.
        El de arbitraje es la <strong>suma de los árbitros elegidos</strong> según
        su tarifa por tramo de horas. Puedes ajustarlos a mano si hay un costo
        especial.
      </p>

      <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 space-y-3">
        <div>
          <p className="text-sm text-tenue">Costo por participante (redondeado)</p>
          <p className="text-2xl font-bold text-orange-700">
            {soles.format(costoPorParticipante)}
          </p>
          <p className="text-xs text-tenue">
            (costo sede + arbitraje) × (1 + % ganancia) ÷ cupos, redondeado hacia
            arriba a soles enteros.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-orange-200 pt-3 text-center">
          <div>
            <p className="text-xs text-tenue">Egresos</p>
            <p className="font-semibold text-texto">{soles.format(egresosTotales)}</p>
          </div>
          <div>
            <p className="text-xs text-tenue">Recauda (si se llena)</p>
            <p className="font-semibold text-texto">
              {soles.format(recaudacionTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-tenue">Ganancia estimada</p>
            <p className="font-semibold text-green-700">
              {soles.format(gananciaTotal)}
            </p>
          </div>
        </div>
      </div>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar'}
        </button>
        <Link
          href="/admin/eventos"
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
