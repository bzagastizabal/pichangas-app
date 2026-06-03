// src/app/admin/jugadores/importar/actions.ts
// Importa o actualiza jugadores en lote desde un CSV. Clave única: DNI.
// Si el DNI ya existe → UPDATE (no toca la contraseña). Si no → crea el auth
// user con la clave por defecto = DNI y luego completa el perfil.
'use server';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizarHeader, parsearCSV, parsearFecha } from '@/lib/csv';
import { normalizarNacionalidad } from '@/lib/nacionalidad';

// Mapa flexible: distintos nombres de columna → campo canónico.
const MAPA: Record<string, keyof Fila> = {
  nombre: 'nombre_completo',
  nombres: 'nombre_completo',
  nombre_completo: 'nombre_completo',
  dni: 'dni',
  documento: 'dni',
  fecha_nacimiento: 'fecha_nacimiento',
  fecha_de_nacimiento: 'fecha_nacimiento',
  nacimiento: 'fecha_nacimiento',
  cumpleanos: 'fecha_nacimiento',
  nacionalidad: 'nacionalidad',
  pais: 'nacionalidad',
  telefono: 'telefono',
  celular: 'telefono',
  whatsapp: 'telefono',
  correo: 'email',
  email: 'email',
  estado: 'estado',
  activo: 'estado',
};

type Fila = {
  nombre_completo: string;
  dni: string;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  telefono: string | null;
  email: string | null;
  estado: boolean | null;
};

export type ImportError = { linea: number; dni: string; motivo: string };
export type ImportResultado = {
  total: number;
  creados: number;
  actualizados: number;
  errores: ImportError[];
  dryRun: boolean;
};
export type ImportEstado = ImportResultado | { error: string } | null;

function parseEstado(s: string | null): boolean | null {
  const t = (s ?? '').trim().toLowerCase();
  if (!t) return null;
  if (['activo', 'active', 'true', '1', 'si', 'sí'].includes(t)) return true;
  if (['de baja', 'inactivo', 'inactive', 'false', '0', 'no'].includes(t)) return false;
  return null;
}

export async function importarJugadoresCSV(
  _prev: ImportEstado,
  formData: FormData,
): Promise<ImportEstado> {
  await requireAdmin();
  const archivo = formData.get('archivo') as File | null;
  const dryRun = formData.get('dry_run') === 'on';
  if (!archivo || archivo.size === 0) return { error: 'Sube un archivo CSV.' };
  if (archivo.size > 2 * 1024 * 1024) {
    return { error: 'El CSV no puede pesar más de 2 MB.' };
  }

  const texto = await archivo.text();
  const filas = parsearCSV(texto);
  if (filas.length < 2) {
    return { error: 'El archivo está vacío o no tiene filas de datos.' };
  }

  const headers = filas[0].map(normalizarHeader);
  const indices: (keyof Fila | null)[] = headers.map((h) => MAPA[h] ?? null);
  const idxDni = indices.findIndex((c) => c === 'dni');
  if (idxDni < 0) {
    return { error: 'La columna "DNI" es obligatoria. Renómbrala en tu archivo y vuelve a subir.' };
  }

  // Construye filas tipadas a partir del CSV.
  const datos: { fila: Fila; linea: number }[] = [];
  for (let r = 1; r < filas.length; r++) {
    const row = filas[r];
    const f: Fila = {
      nombre_completo: '',
      dni: '',
      fecha_nacimiento: null,
      nacionalidad: null,
      telefono: null,
      email: null,
      estado: null,
    };
    indices.forEach((campo, j) => {
      const v = (row[j] ?? '').trim();
      if (!campo) return;
      if (campo === 'fecha_nacimiento') f.fecha_nacimiento = parsearFecha(v);
      else if (campo === 'estado') f.estado = parseEstado(v);
      else if (campo === 'email') f[campo] = v.toLowerCase() || null;
      else if (campo === 'nacionalidad') f.nacionalidad = v ? normalizarNacionalidad(v) || null : null;
      else if (campo === 'telefono') f.telefono = v || null;
      else if (campo === 'dni' || campo === 'nombre_completo') f[campo] = v;
    });
    datos.push({ fila: f, linea: r + 1 });
  }

  // Pre-detecta los DNIs que ya existen para no consultar uno por uno.
  const admin = createAdminClient();
  const dnis = Array.from(new Set(datos.map((d) => d.fila.dni).filter(Boolean)));
  const existePorDni = new Map<string, string>();
  if (dnis.length > 0) {
    const { data: existentes } = await admin
      .from('perfiles')
      .select('id, dni')
      .in('dni', dnis);
    for (const p of (existentes as { id: string; dni: string | null }[] | null) ?? []) {
      if (p.dni) existePorDni.set(p.dni, p.id);
    }
  }

  let creados = 0;
  let actualizados = 0;
  const errores: ImportError[] = [];
  const vistosEnArchivo = new Set<string>();

  for (const { fila, linea } of datos) {
    const dni = fila.dni;
    if (!dni) {
      errores.push({ linea, dni: '', motivo: 'Falta DNI' });
      continue;
    }
    if (dni.length < 6) {
      errores.push({ linea, dni, motivo: 'DNI menor a 6 caracteres' });
      continue;
    }
    if (!fila.nombre_completo) {
      errores.push({ linea, dni, motivo: 'Falta nombre completo' });
      continue;
    }
    if (vistosEnArchivo.has(dni)) {
      errores.push({ linea, dni, motivo: 'DNI duplicado en el archivo' });
      continue;
    }
    vistosEnArchivo.add(dni);

    const idExistente = existePorDni.get(dni);

    // Dry run: cuenta como si fuera real pero no escribe.
    if (dryRun) {
      if (idExistente) actualizados++;
      else creados++;
      continue;
    }

    if (idExistente) {
      const updates: Record<string, unknown> = {
        nombre_completo: fila.nombre_completo,
      };
      if (fila.telefono !== null) updates.telefono = fila.telefono;
      if (fila.fecha_nacimiento !== null) updates.fecha_nacimiento = fila.fecha_nacimiento;
      if (fila.nacionalidad !== null) updates.nacionalidad = fila.nacionalidad;
      if (fila.estado !== null) updates.activo = fila.estado;
      const { error } = await admin
        .from('perfiles')
        .update(updates)
        .eq('id', idExistente);
      if (error) {
        errores.push({ linea, dni, motivo: error.message });
      } else {
        actualizados++;
      }
    } else {
      const email = fila.email || `${dni}@jugador.cmt`;
      const { data: nuevo, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: dni,
        user_metadata: {
          nombre_completo: fila.nombre_completo,
          telefono: fila.telefono ?? '',
          dni,
        },
      });
      if (error || !nuevo?.user?.id) {
        errores.push({ linea, dni, motivo: error?.message ?? 'no se pudo crear el usuario' });
        continue;
      }
      // Completa fecha_nacimiento / nacionalidad / estado en el perfil recién
      // creado (el trigger los deja nulos).
      const upd: Record<string, unknown> = {};
      if (fila.fecha_nacimiento) upd.fecha_nacimiento = fila.fecha_nacimiento;
      if (fila.nacionalidad) upd.nacionalidad = fila.nacionalidad;
      if (fila.estado === false) upd.activo = false;
      if (Object.keys(upd).length > 0) {
        await admin.from('perfiles').update(upd).eq('id', nuevo.user.id);
      }
      creados++;
    }
  }

  return {
    total: datos.length,
    creados,
    actualizados,
    errores,
    dryRun,
  };
}
