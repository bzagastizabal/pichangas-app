'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { comprimirImagen } from '@/lib/imagen';
import { crearPublicacion } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export function FormPublicacion({ eventos }: { eventos: { id: string; nombre: string }[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [eventoId, setEventoId] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [archivos, setArchivos] = useState<File[]>([]);

  async function publicar() {
    if (!titulo.trim()) {
      setEstado('Falta el título.');
      return;
    }
    setCargando(true);
    setEstado('');
    try {
      const rutas: string[] = [];
      for (const f of archivos) {
        const blob = await comprimirImagen(f);
        const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error } = await supabase.storage
          .from('publicaciones')
          .upload(ruta, blob, { contentType: 'image/webp' });
        if (error) throw new Error(error.message);
        rutas.push(ruta);
      }
      const r = await crearPublicacion({ titulo, descripcion, eventoId: eventoId || null, imagenes: rutas });
      if (r.error) throw new Error(r.error);

      setTitulo('');
      setDescripcion('');
      setEventoId('');
      setArchivos([]);
      setInputKey((k) => k + 1);
      setEstado('¡Publicado!');
      router.refresh();
    } catch (e) {
      setEstado('Error: ' + (e instanceof Error ? e.message : 'desconocido'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className={input}
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <textarea
        className={input}
        rows={3}
        placeholder="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <select className={input} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
        <option value="">Sin evento asociado</option>
        {eventos.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.nombre}
          </option>
        ))}
      </select>
      <div>
        <label className="block text-xs text-tenue mb-1">
          Imágenes (se comprimen automáticamente)
        </label>
        <input
          key={inputKey}
          type="file"
          accept="image/*"
          multiple
          className="block w-full text-sm"
          onChange={(e) => setArchivos(e.target.files ? Array.from(e.target.files) : [])}
        />
        {archivos.length > 0 && (
          <p className="mt-1 text-xs text-tenue">{archivos.length} imagen(es) seleccionada(s)</p>
        )}
      </div>
      <button
        type="button"
        onClick={publicar}
        disabled={cargando}
        className="bg-orange-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {cargando ? 'Publicando…' : 'Publicar'}
      </button>
      {estado && <p className="text-sm text-tenue">{estado}</p>}
    </div>
  );
}
