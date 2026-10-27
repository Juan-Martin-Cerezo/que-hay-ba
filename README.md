<p align="center">
  <img src="docs/banner.webp" alt="Qué Hay BA: agenda cultural de Buenos Aires sobre un mapa" width="100%">
</p>

<h1 align="center">Qué Hay BA</h1>

<p align="center">
  Agenda cultural de la Ciudad de Buenos Aires sobre un mapa interactivo.<br>
  Ingesta tres fuentes públicas, normaliza precios y horarios, geocodifica cada evento<br>
  y los publica como una API GeoJSON.
</p>

<p align="center">
  <a href="https://que-hay-ba.vercel.app"><b>Demo</b></a> ·
  <a href="docs/ARCHITECTURE.md">Arquitectura</a> ·
  <a href="docs/DATA-SOURCES.md">Fuentes de datos</a> ·
  <a href="CONTRIBUTING.md">Contribuir</a>
</p>

<p align="center">
  <a href="https://github.com/Juan-Martin-Cerezo/que-hay-ba/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Juan-Martin-Cerezo/que-hay-ba/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3f3f46">
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-3f3f46">
  <img alt="Next.js 16" src="https://img.shields.io/badge/next.js-16-3f3f46">
</p>

<table>
  <tr>
    <td width="72%"><img src="docs/screenshots/map-desktop.webp" alt="Mapa de eventos en escritorio"></td>
    <td width="28%"><img src="docs/screenshots/map-mobile.webp" alt="Cartelera en móvil"></td>
  </tr>
  <tr>
    <td align="center"><sub>Escritorio: mapa, filtros y cartelera sincronizada</sub></td>
    <td align="center"><sub>Móvil: lista y ficha de evento</sub></td>
  </tr>
</table>

## Qué hace

- **Tres fuentes, un formato.** Agenda oficial del GCBA (Linda), Alternativa Teatral y Eventbrite. Cada una tiene su parser en `src/ingest/sources/` y todas convergen al mismo tipo `RawEvent`.
- **Normalización real.** Seis categorías, detección de eventos gratuitos, rangos de precio en ARS y deduplicación entre fuentes por título, sede y franja de 30 minutos.
- **Geocodificación en cascada.** Coordenadas del origen → catálogo de sedes de CABA → caché en base → USIG (GCBA) → Nominatim acotado al polígono de la ciudad. Si nada resuelve, el evento se descarta: no se inventan coordenadas.
- **Mapa propio.** MapLibre con tiles de OpenStreetMap y del mapa oficial del GCBA, cuatro estilos, agrupación de eventos por sede y popover con todas las actividades de un mismo lugar.
- **Filtros que sirven.** Ahora, hoy, este fin de semana, fecha exacta, categoría, rango de precio, barrio y búsqueda libre.
- **Ficha de evento.** Próxima función, precio, sede, distancia, agregar a Google Calendar, cómo llegar y favoritos en `localStorage`.

## Stack

| Capa          | Tecnología                                        |
| ------------- | ------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Mapa          | MapLibre GL JS                                    |
| Base de datos | PostgreSQL 14+ (Supabase o Postgres local)        |
| Cliente SQL   | `postgres` (postgres.js)                          |
| Ingesta       | `tsx` + scripts en `src/ingest/`                  |

## Cómo correrlo

Requisitos: Node 20 o superior y una base PostgreSQL (local o Supabase).

```bash
git clone https://github.com/Juan-Martin-Cerezo/que-hay-ba.git
cd que-hay-ba
npm install
cp .env.example .env.local   # completá DATABASE_URL
npm run db:setup             # migraciones + sedes + primera ingesta
npm run dev                  # http://localhost:3000
```

Con Postgres local:

```bash
createdb quehayba
echo 'DATABASE_URL=postgres://localhost:5432/quehayba' >> .env.local
```

El schema vive en `supabase/migrations/`. Las migraciones son re-ejecutables y se aplican en orden alfabético, así que `npm run db:setup` también actualiza una base existente.

## Variables de entorno

| Variable           | Obligatoria      | Para qué                                                                                              |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | sí               | Conexión a Postgres. Con Supabase, usá el connection string del **transaction pooler** (puerto 6543). |
| `CRON_SECRET`      | sí en producción | Token que protege `/api/cron/:source`. Si falta, el endpoint responde 401.                            |
| `PERPETUAL_EVENTS` | no               | `false` hace que los eventos vencidos se borren en lugar de reprogramarse (ver abajo).                |

## Ingesta

```bash
npm run ingest                             # las tres fuentes
npx tsx scripts/ingest.ts --source=gcba    # una sola
npx tsx scripts/ingest.ts --migrate --seed # migraciones + sedes
```

En producción, `vercel.json` programa las tres fuentes a las 8:00, 8:20 y 8:40 (hora argentina) y llama a `/api/cron/:source` con `Authorization: Bearer $CRON_SECRET`. En cualquier otro hosting, apuntá un cron al mismo endpoint.

**Sobre `PERPETUAL_EVENTS`:** el modo perpetuo (por defecto) mueve los eventos vencidos en saltos de 7 días para conservar día de la semana y horario. Sirve para demos y ciclos semanales, pero implica mostrar ocurrencias futuras que las fuentes no publicaron. Para una agenda estrictamente fiel, poné `PERPETUAL_EVENTS=false`: los eventos vencidos se eliminan después de 24 horas.

## API

| Endpoint                | Descripción                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events`       | GeoJSON de eventos. Query params: `when` (`now`, `today`, `weekend`, `YYYY-MM-DD`), `cat` (separada por comas), `price` (`free`, `eco`, `mod`, `premium`), `q`. |
| `GET /api/events/:id`   | Ficha completa con las próximas funciones de la misma obra.                                                                                                     |
| `GET /api/cron/:source` | Dispara la ingesta de una fuente. Requiere `CRON_SECRET`.                                                                                                       |
| `GET /api/health`       | Estado de la base. 503 con el motivo si falta `DATABASE_URL` o Postgres no responde.                                                                            |

## Deploy

1. Creá una base Postgres y corré `npx tsx scripts/ingest.ts --migrate --seed`.
2. Importá el repo en Vercel (o cualquier host Node) y definí `DATABASE_URL` y `CRON_SECRET`.
3. Programá las ingestas: `vercel.json` ya lo hace en Vercel; en otros hosts, apuntá un cron a `/api/cron/gcba` y compañía con el header de autorización.

No hay servicios propietarios en el camino crítico: sin Supabase ni Vercel alcanza con un Postgres y un cron.

## Estructura

```
src/app/            rutas, layout y endpoints (App Router)
src/components/     mapa, filtros, cartelera y ficha de evento
src/ingest/         fuentes, normalización, geocodificación y upsert
src/lib/            base de datos, dominio, formato y favoritos
scripts/ingest.ts   CLI de ingesta y migraciones
supabase/           migraciones SQL
docs/               arquitectura, fuentes y capturas
```

Más detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

## Fuentes y atribución

Los datos pertenecen a sus publicadores. El proyecto linkea siempre a la página original de cada evento y no redistribuye contenido completo. La cartografía es de [OpenStreetMap](https://www.openstreetmap.org/copyright) y del [mapa oficial del GCBA (USIG)](https://servicios.usig.buenosaires.gob.ar). Los términos de cada fuente y los recaudos para scrapear están en [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

## Cómo contribuir

Issues y pull requests son bienvenidos. Antes de abrir un PR, leé [`CONTRIBUTING.md`](CONTRIBUTING.md) y corré `npm run format:check`, `npm run lint`, `npm run typecheck` y `npm test`.

Buenas primeras contribuciones:

- Tests de parser con fixtures guardados: las tres fuentes cambian su markup sin aviso.
- Agrupar pines por zoom en lugar de recortar por cantidad.
- Sumar fuentes nuevas (CCK, centros culturales barriales, universidades).
- Accesibilidad de la cartelera y del popover del mapa.

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
