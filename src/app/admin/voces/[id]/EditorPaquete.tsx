// src/app/admin/voces/[id]/EditorPaquete.tsx
// Grilla de ranuras del pack. Cada ranura muestra el guion sugerido, el
// nombre de archivo que espera la subida masiva, un player de preview y el
// input de subida (se envía solo al elegir el archivo).
'use client';

import { useRef, useState } from 'react';
import { GRUPOS, RANURAS } from '@/lib/voces';
import { eliminarClip, subirClips } from '../actions';

type ClipUI = { id: string; url: string };

export function EditorPaquete({
  paqueteId,
  clipsPorClave,
}: {
  paqueteId: string;
  clipsPorClave: Record<string, ClipUI>;
}) {
  const [subiendo, setSubiendo] = useState(false);

  return (
    <div className="space-y-6">
      {/* Subida masiva: los nombres de archivo deciden la ranura. */}
      <form
        action={subirClips}
        onSubmit={() => setSubiendo(true)}
        className="rounded-xl border border-orange-500/30 bg-orange-600/10 p-4 space-y-2"
      >
        <input type="hidden" name="paquete_id" value={paqueteId} />
        <p className="text-sm font-semibold">Subir varios de una vez</p>
        <p className="text-xs text-tenue">
          Nombra cada archivo como la ranura: <code>h180.mp3</code>, <code>h60.mp3</code>,{' '}
          <code>c10.mp3</code>, <code>fin.mp3</code>… También acepta{' '}
          <code>3min.mp3</code> o <code>30.mp3</code> para los avisos. MP3, WAV, OGG o
          M4A, máximo 3 MB cada uno.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="archivos"
            accept="audio/*"
            multiple
            className="text-xs"
            required
          />
          <button
            type="submit"
            disabled={subiendo}
            className="bg-orange-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {subiendo ? 'Subiendo…' : 'Subir'}
          </button>
        </div>
      </form>

      {GRUPOS.map((g) => (
        <section key={g.grupo} className="space-y-2">
          <div>
            <h2 className="font-semibold">{g.titulo}</h2>
            <p className="text-xs text-tenue">{g.ayuda}</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RANURAS.filter((r) => r.grupo === g.grupo).map((r) => (
              <Ranura
                key={r.clave}
                paqueteId={paqueteId}
                clave={r.clave}
                titulo={r.titulo}
                guion={r.guion}
                archivo={r.archivo}
                clip={clipsPorClave[r.clave]}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Ranura({
  paqueteId,
  clave,
  titulo,
  guion,
  archivo,
  clip,
}: {
  paqueteId: string;
  clave: string;
  titulo: string;
  guion: string;
  archivo: string;
  clip?: ClipUI;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <li
      className={`rounded-lg border p-3 space-y-2 ${
        clip ? 'border-green-500/30 bg-green-500/5' : 'border-borde'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{titulo}</p>
        <code className="text-[0.65rem] text-tenue">{archivo}</code>
      </div>
      <p className="text-xs text-tenue">“{guion}”</p>

      {clip ? (
        <div className="flex items-center gap-2">
          <audio controls preload="none" src={clip.url} className="h-8 w-full max-w-full" />
          <form action={eliminarClip}>
            <input type="hidden" name="id" value={clip.id} />
            <button
              type="submit"
              title="Quitar este audio"
              className="text-red-300 hover:text-red-200 text-sm px-1"
            >
              ✕
            </button>
          </form>
        </div>
      ) : (
        <p className="text-[0.7rem] text-amber-300">Sin audio — usará la voz del sistema.</p>
      )}

      {/* Subida individual: se envía sola al elegir archivo. */}
      <form ref={formRef} action={subirClips}>
        <input type="hidden" name="paquete_id" value={paqueteId} />
        <input type="hidden" name="clave" value={clave} />
        <input
          type="file"
          name="archivos"
          accept="audio/*"
          className="text-[0.7rem] w-full"
          onChange={(e) => {
            if (e.target.files?.length) formRef.current?.requestSubmit();
          }}
        />
      </form>
    </li>
  );
}
