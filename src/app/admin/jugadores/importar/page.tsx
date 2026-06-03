// src/app/admin/jugadores/importar/page.tsx
// Carga masiva (CSV) de jugadores con upsert por DNI. Soporta dry-run para
// previsualizar y la misma vista sirve para actualizar (sube de nuevo el CSV
// con los cambios).
import Link from 'next/link';
import { FormImportar } from './FormImportar';

export default function ImportarJugadoresPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/jugadores" className="text-sm text-tenue hover:underline">
          ← Jugadores
        </Link>
        <h1 className="text-2xl font-bold">Importar jugadores (CSV)</h1>
        <p className="text-sm text-tenue">
          La clave es el <strong>DNI</strong>. Si el DNI existe se{' '}
          <strong>actualiza</strong> el perfil; si no, se{' '}
          <strong>crea</strong> el usuario (contraseña inicial = DNI) y se rellena
          su perfil.
        </p>
      </div>

      <div className="rounded-lg border border-borde p-4 space-y-3 text-sm">
        <p className="font-medium">Columnas reconocidas (case-insensitive, sin acentos):</p>
        <ul className="space-y-1 text-tenue">
          <li>· <code>Nombre completo</code> (o <code>Nombre</code>) — obligatorio</li>
          <li>· <code>DNI</code> (o <code>Documento</code>) — obligatorio, clave única</li>
          <li>· <code>Fecha de nacimiento</code> — ISO (1990-05-15) o DD/MM/YYYY</li>
          <li>· <code>Nacionalidad</code> (o <code>Pais</code>)</li>
          <li>· <code>Telefono</code> (o <code>Celular</code>, <code>WhatsApp</code>) — con código de país</li>
          <li>· <code>Email</code> (o <code>Correo</code>) — opcional, se sintetiza <code>dni@jugador.cmt</code> si no viene</li>
          <li>· <code>Estado</code> — <code>activo</code> / <code>de baja</code> (opcional)</li>
        </ul>
        <p className="text-xs text-tenue">
          Las columnas <em>Edad</em> y <em>Categoría sugerida</em> se ignoran (se calculan a partir
          de la fecha de nacimiento). Si ya tienes jugadores cargados, puedes
          descargar el padrón actual desde <strong>Exportar</strong>, editarlo en
          Excel y volver a subirlo aquí — los DNIs existentes se actualizan.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a
            href="/admin/jugadores/importar/plantilla"
            className="rounded border border-borde px-3 py-1.5 text-sm hover:border-orange-500"
          >
            ↓ Descargar plantilla
          </a>
          <a
            href="/admin/jugadores/exportar"
            className="rounded border border-borde px-3 py-1.5 text-sm hover:border-orange-500"
          >
            ↓ Descargar padrón actual
          </a>
        </div>
      </div>

      <FormImportar />
    </div>
  );
}
