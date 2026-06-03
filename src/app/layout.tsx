import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { BotonAyuda } from "./BotonAyuda";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografía estilo "scoreboard LED" para los marcadores. display: swap evita
// FOIT (parpadeo blanco mientras carga).
const orbitron = Orbitron({
  variable: "--font-orbitron-css",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700", "900"],
});

// Base absoluta para resolver imagenes y enlaces de Open Graph. WhatsApp/Twitter
// /Facebook necesitan URLs absolutas; con metadataBase, Next resuelve las rutas
// relativas ('/og-image.jpg') contra esta URL.
const sitio =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pichangas-app.vercel.app';

const NOMBRE = 'CMT BasketBall Club — Clorinda Matto de Turner';
const TITULO = `${NOMBRE} · Pichangas 🏀`;
const DESCRIPCION =
  'Plataforma del CMT BasketBall Club (Clorinda Matto de Turner) para inscribirte a las pichangas y pagar tu cupo.';

export const metadata: Metadata = {
  metadataBase: new URL(sitio),
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    type: 'website',
    siteName: NOMBRE,
    title: TITULO,
    description: DESCRIPCION,
    locale: 'es_PE',
    images: [
      { url: '/og-image.jpg', width: 1200, height: 630, alt: NOMBRE },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BotonAyuda />
      </body>
    </html>
  );
}
