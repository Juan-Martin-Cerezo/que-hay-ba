import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const displaySerif = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Qué Hay BA — Cartografía Cultural y Eventos en Vivo · CABA",
  description:
    "Atlas interactivo en tiempo real de recitales, teatro, museos, ferias gastronómicas, talleres y actividades gratuitas en la Ciudad Autónoma de Buenos Aires.",
  openGraph: {
    title: "Qué Hay BA — Cartografía Cultural de Buenos Aires",
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
      className={`${displaySerif.variable} ${jakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
