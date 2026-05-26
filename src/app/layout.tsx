import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

// Base absoluta para resolver imagenes y enlaces de Open Graph. WhatsApp/Twitter
// /Facebook necesitan URLs absolutas; con metadataBase, Next resuelve las rutas
// relativas ('/og-image.jpg') contra esta URL.
const sitio =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pichangas-app.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(sitio),
  title: 'CMT Basquetball — Pichangas 🏀',
  description:
    'Plataforma del CMT Basquetball Club para inscribirte a las pichangas y pagar tu cupo.',
  openGraph: {
    type: 'website',
    siteName: 'CMT Basquetball',
    title: 'CMT Basquetball — Pichangas 🏀',
    description:
      'Plataforma del CMT Basquetball Club para inscribirte a las pichangas y pagar tu cupo.',
    locale: 'es_PE',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CMT Basquetball Club',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CMT Basquetball — Pichangas 🏀',
    description:
      'Plataforma del CMT Basquetball Club para inscribirte a las pichangas y pagar tu cupo.',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BotonAyuda />
      </body>
    </html>
  );
}
