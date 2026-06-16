// OG image dinámico para el link de inscripción. WhatsApp/Twitter ven la sede,
// fecha, costo y CUPOS DISPONIBLES en grande, en vez de la card genérica del
// club. Si está agotado, el badge cambia a rojo.
//
// Satori (motor de ImageResponse) exige `display: flex` en cada <div> con más
// de un nodo hijo, por eso todos los containers lo declaran y los textos van
// en una sola expresión.
import { ImageResponse } from 'next/og';
import fs from 'node:fs';
import path from 'node:path';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatearFechaLima } from '@/lib/fechas';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Pichanga CMT BasketBall Club — inscríbete';

function logoDataUri(): string {
  const buf = fs.readFileSync(path.join(process.cwd(), 'public/cmt_insignia.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

type Mini = {
  id: string;
  fecha_hora_evento: string;
  costo_por_participante: number;
  cupos_totales: number;
  sedes: { nombre: string } | null;
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from('eventos')
    .select('id, fecha_hora_evento, costo_por_participante, cupos_totales, sedes(nombre)')
    .eq('slug_inscripcion', slug)
    .maybeSingle();
  const ev = (data as unknown as Mini | null) ?? {
    id: '',
    fecha_hora_evento: new Date().toISOString(),
    costo_por_participante: 0,
    cupos_totales: 0,
    sedes: null,
  };

  let ocupados = 0;
  if (ev.id) {
    const { count } = await admin
      .from('inscripciones')
      .select('*', { count: 'exact', head: true })
      .eq('evento_id', ev.id)
      .in('estado', ['pendiente', 'confirmado']);
    ocupados = count ?? 0;
  }
  const disponibles = Math.max(0, ev.cupos_totales - ocupados);
  const agotado = disponibles === 0 && ev.cupos_totales > 0;
  const pocos = !agotado && disponibles > 0 && disponibles <= 3;

  const sede = ev.sedes?.nombre ?? 'Cancha';
  const fecha = formatearFechaLima(ev.fecha_hora_evento);
  const costo = soles.format(Number(ev.costo_por_participante));
  const logo = logoDataUri();

  // Colores de la card de cupos según disponibilidad.
  const cupoColor = agotado
    ? { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.6)', txt: '#fecaca' }
    : pocos
      ? { bg: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.6)', txt: '#fde68a' }
      : { bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.6)', txt: '#bbf7d0' };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #18181b 0%, #000000 60%, #1a1a1d 100%)',
          color: '#ffffff',
          padding: 52,
          fontFamily: 'sans-serif',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={logo} width={72} height={72} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                }}
              >
                CMT BasketBall Club
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 15,
                  color: '#a1a1aa',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              >
                Clorinda Matto de Turner
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(251,146,60,0.18)',
              border: '2px solid rgba(251,146,60,0.55)',
              borderRadius: 999,
              padding: '8px 20px',
              fontSize: 20,
              color: '#fdba74',
              letterSpacing: 4,
              textTransform: 'uppercase',
              fontWeight: 800,
            }}
          >
            🏀 Pichanga
          </div>
        </div>

        {/* CUERPO */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 18,
            marginTop: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: 6,
              fontWeight: 700,
            }}
          >
            Inscríbete a la
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 78,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {`Pichanga en ${sede}`}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 32,
              alignItems: 'center',
              fontSize: 28,
              color: '#e4e4e7',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', color: '#fdba74', fontWeight: 800 }}>📅</div>
              <div style={{ display: 'flex' }}>{fecha}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', color: '#fdba74', fontWeight: 800 }}>💸</div>
              <div style={{ display: 'flex', fontWeight: 700 }}>{costo} por jugador</div>
            </div>
          </div>

          {/* CARD DE CUPOS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: cupoColor.bg,
              border: `3px solid ${cupoColor.border}`,
              borderRadius: 22,
              padding: '20px 32px',
              alignSelf: 'flex-start',
              marginTop: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                fontWeight: 900,
                color: cupoColor.txt,
                lineHeight: 1,
              }}
            >
              {agotado ? '✕' : String(disponibles)}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                color: cupoColor.txt,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                }}
              >
                {agotado ? 'Cupos agotados' : 'Cupos disponibles'}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  letterSpacing: 2,
                  opacity: 0.8,
                }}
              >
                {agotado
                  ? `Lista de espera abierta · ${ev.cupos_totales} totales`
                  : `de ${ev.cupos_totales} totales`}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: 18,
            color: '#52525b',
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          pichangas-app.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
