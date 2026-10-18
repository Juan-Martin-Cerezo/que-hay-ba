import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qué Hay BA — Mapa Interactivo de Actividades y Eventos en CABA",
  description:
    "Descubrí recitales, teatro, museos, ferias gastronómicas, talleres y actividades gratuitas en la Ciudad Autónoma de Buenos Aires en tiempo real.",
  openGraph: {
    title: "Qué Hay BA — Actividades y Eventos en Buenos Aires",
    description:
      "Mapa interactivo en tiempo real con la agenda cultural, teatral y recreativa de la Ciudad de Buenos Aires.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
