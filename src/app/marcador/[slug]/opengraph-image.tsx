// OG image dinámico por marcador: WhatsApp/Twitter muestran el marcador real
// con etiqueta "MARCADOR EN VIVO" en vez de la card genérica del club.
// Satori (motor de ImageResponse) exige `display: flex` en cualquier <div>
// con más de un nodo hijo, por eso todos los containers lo declaran y los
// textos se concatenan en una sola expresión.
import { ImageResponse } from 'next/og';
import fs from 'node:fs';
import path from 'node:path';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Marcador en vivo CMT BasketBall Club';

function logoDataUri(): string {
  const buf = fs.readFileSync(path.join(process.cwd(), 'public/cmt_insignia.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

type Mini = {
  nombre_local: string;
  nombre_visitante: string;
  puntos_local: number;
  puntos_visitante: number;
  periodo: number;
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from('marcadores')
    .select('nombre_local, nombre_visitante, puntos_local, puntos_visitante, periodo')
    .eq('slug', slug)
    .maybeSingle();
  const m = (data as Mini | null) ?? {
    nombre_local: 'LOCAL',
    nombre_visitante: 'VISITANTE',
    puntos_local: 0,
    puntos_visitante: 0,
    periodo: 1,
  };
  const logo = logoDataUri();
  const periodoEtiqueta = m.periodo <= 4 ? `Q${m.periodo}` : `OT${m.periodo - 4}`;

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
          padding: 56,
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
          {/* Identidad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={logo} width={76} height={76} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
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
                  fontSize: 16,
                  color: '#a1a1aa',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              >
                Clorinda Matto de Turner
              </div>
            </div>
          </div>

          {/* Badge LIVE */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(239,68,68,0.18)',
              border: '2px solid rgba(239,68,68,0.45)',
              borderRadius: 999,
              padding: '10px 22px',
              fontSize: 22,
              color: '#fecaca',
              letterSpacing: 4,
              textTransform: 'uppercase',
              fontWeight: 800,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 12,
                height: 12,
                background: '#ef4444',
                borderRadius: 999,
              }}
            />
            <div style={{ display: 'flex' }}>Marcador en vivo</div>
          </div>
        </div>

        {/* CUERPO */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
            {/* LOCAL */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 36,
                  color: '#fdba74',
                  textTransform: 'uppercase',
                  letterSpacing: 6,
                  fontWeight: 800,
                  maxWidth: 460,
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                {m.nombre_local}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 200,
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1,
                  marginTop: 12,
                }}
              >
                {String(m.puntos_local)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 110,
                color: '#3f3f46',
                marginTop: 70,
                fontWeight: 700,
              }}
            >
              –
            </div>

            {/* VISITANTE */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 36,
                  color: '#7dd3fc',
                  textTransform: 'uppercase',
                  letterSpacing: 6,
                  fontWeight: 800,
                  maxWidth: 460,
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                {m.nombre_visitante}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 200,
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1,
                  marginTop: 12,
                }}
              >
                {String(m.puntos_visitante)}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 36,
              color: '#a1a1aa',
              letterSpacing: 10,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {`Periodo ${periodoEtiqueta}`}
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
