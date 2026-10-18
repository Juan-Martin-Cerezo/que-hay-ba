import Link from "next/link";

export const metadata = {
  title: "Fuentes y Acerca de — Qué Hay BA",
};

export default function AcercaPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-slate-800 dark:text-slate-100">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
      >
        ← Volver al mapa
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Acerca de Qué Hay BA</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <strong>Qué Hay BA</strong> reúne en un único mapa interactivo la cartelera cultural,
        recreativa y de espectáculos de la Ciudad Autónoma de Buenos Aires, permitiendo filtrar por
        presupuesto, categoría y horario.
      </p>

      <h2 className="mt-8 text-lg font-bold">Fuentes de datos públicas</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>
          <strong>Agenda Cultural GCBA (Disfrutemos BA / Linda):</strong> actividades oficiales en
          museos, centros culturales, parques y espacios públicos de la Ciudad.
        </li>
        <li>
          <strong>Alternativa Teatral:</strong> cartelera de teatro independiente, danza, música y
          artes escénicas en salas de CABA.
        </li>
        <li>
          <strong>Eventbrite CABA:</strong> talleres, conferencias, música en vivo, ferias y
          encuentros comunitarios en Buenos Aires.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-bold">Cartografía y geocodificación</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Los mapas utilizan teselas vectoriales de{" "}
        <a
          href="https://openfreemap.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenFreeMap
        </a>{" "}
        con datos de colaboradores de{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        y el servicio oficial de normalización geográfica{" "}
        <a
          href="https://servicios.usig.buenosaires.gob.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          USIG GCBA
        </a>
        .
      </p>
    </main>
  );
}
