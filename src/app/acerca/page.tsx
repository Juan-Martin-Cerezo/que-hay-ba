import Link from "next/link";

export const metadata = {
  title: "Fuentes y Acerca de — Qué Hay BA",
};

export default function AcercaPage() {
  return (
    <main className="min-h-dvh bg-ink px-6 py-12 text-fg">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-medium text-muted transition hover:border-fg/30 hover:text-fg"
        >
          ← Volver al mapa
        </Link>

        <h1 className="mt-8 font-display text-3xl tracking-tight text-fg">Acerca de Qué Hay BA</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <strong className="text-fg">Qué Hay BA</strong> reúne en un único atlas cartográfico la
          cartelera cultural, gastronómica, teatral y recreativa de la Ciudad Autónoma de Buenos
          Aires, permitiendo explorar por barrio, presupuesto, categoría y horario en tiempo real.
        </p>

        <h2 className="mt-8 font-mono text-[11px] uppercase tracking-wider text-muted">
          Fuentes de datos públicas
        </h2>
        <ul className="mt-3 space-y-2.5 border-l border-line pl-4 text-sm text-muted">
          <li>
            <strong className="text-fg">Agenda Cultural GCBA (Disfrutemos BA / Linda):</strong>{" "}
            actividades oficiales en museos, centros culturales, parques y espacios públicos de la
            Ciudad.
          </li>
          <li>
            <strong className="text-fg">Alternativa Teatral:</strong> cartelera de teatro
            independiente, danza, música y artes escénicas en salas de CABA.
          </li>
          <li>
            <strong className="text-fg">Eventbrite CABA:</strong> talleres, conferencias, música en
            vivo, ferias y encuentros comunitarios en Buenos Aires.
          </li>
        </ul>

        <h2 className="mt-8 font-mono text-[11px] uppercase tracking-wider text-muted">
          Cartografía y geocodificación
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Los mapas utilizan teselas de{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4"
          >
            OpenStreetMap
          </a>{" "}
          y el servicio oficial de normalización geográfica{" "}
          <a
            href="https://servicios.usig.buenosaires.gob.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4"
          >
            USIG GCBA
          </a>
          .
        </p>
      </div>
    </main>
  );
}
