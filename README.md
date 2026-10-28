<p align="center">
  <img src="docs/banner.webp" alt="Qué Hay BA: cultural agenda of Buenos Aires on a map" width="100%">
</p>

<h1 align="center">Qué Hay BA</h1>

<p align="center">
  Cultural agenda for the City of Buenos Aires on an interactive map.<br>
  It ingests three public sources, normalises prices and schedules, geocodes every venue<br>
  and serves the result as a GeoJSON API.
</p>

<p align="center">
  <a href="https://que-hay-ba.vercel.app"><b>Live demo</b></a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/DATA-SOURCES.md">Data sources</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/Juan-Martin-Cerezo/que-hay-ba/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Juan-Martin-Cerezo/que-hay-ba/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3f3f46">
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-3f3f46">
  <img alt="Next.js 16" src="https://img.shields.io/badge/next.js-16-3f3f46">
</p>

<table>
  <tr>
    <td width="72%"><img src="docs/screenshots/map-desktop.webp" alt="Event map on desktop"></td>
    <td width="28%"><img src="docs/screenshots/map-mobile.webp" alt="Event list on mobile"></td>
  </tr>
  <tr>
    <td align="center"><sub>Desktop: map, filters and synced listing</sub></td>
    <td align="center"><sub>Mobile: list and event details</sub></td>
  </tr>
</table>

## What it does

- **Three sources, one schema.** The official GCBA agenda (Linda), Alternativa Teatral and Eventbrite. Each parser lives in `src/ingest/sources/` and returns the same `RawEvent` type.
- **Normalisation.** Six categories, free/paid detection, ARS price ranges, and cross-source deduplication on title, venue and a 30-minute time slot.
- **Geocoding in cascade.** Source coordinates, then a curated venue catalogue, then a Postgres cache, then USIG (GCBA), then Nominatim bounded to the city polygon. An event that resolves nowhere is dropped; coordinates are never estimated.
- **Own map.** MapLibre with OpenStreetMap and USIG tiles, four styles, one marker per venue, and a popover listing every activity at a place.
- **Filters that match the data.** Now, today, this weekend, a specific date, category, price bucket, and free-text search over title, venue, neighbourhood and description.
- **Event sheet.** Next showtimes, price, venue, distance, Google Calendar link, transit directions, and favourites stored in `localStorage`.

## Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Map      | MapLibre GL JS                                    |
| Database | PostgreSQL 14+ (Supabase or local Postgres)       |
| SQL      | `postgres` (postgres.js)                          |
| Ingest   | `tsx` scripts under `src/ingest/`                 |

## Quick start

Requirements: Node 20 or newer and a PostgreSQL database, either local or on Supabase.

```bash
git clone https://github.com/Juan-Martin-Cerezo/que-hay-ba.git
cd que-hay-ba
npm install
cp .env.example .env.local   # set DATABASE_URL
npm run db:setup             # migrations, venue seed and first ingest
npm run dev                  # http://localhost:3000
```

`db:setup` runs the SQL migrations, seeds the curated venue list and ingests all three sources. The first run takes a few minutes because every unknown venue goes through USIG and Nominatim.

### Local Postgres

```bash
createdb quehayba
```

Then set the connection string in `.env.local`:

```bash
DATABASE_URL=postgres://localhost:5432/quehayba
```

### Supabase

Create a project, open **Database settings**, copy the connection string and use the transaction pooler on port 6543. The client runs with `prepare: false`, which that pooler requires. TLS is enabled automatically for any host that is not `localhost` or `127.0.0.1`.

The schema lives in `supabase/migrations/`. Every file is written to be re-runnable and they are applied in alphabetical order, so `npm run db:setup` also updates an existing database.

## Environment variables

| Variable           | Required   | Purpose                                                                                                                           |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | Yes        | Postgres connection string. With Supabase, use the transaction pooler (port 6543).                                                |
| `CRON_SECRET`      | Production | Bearer token expected by `/api/cron/:source`. When it is unset the endpoint returns 401 and ingest cannot be triggered over HTTP. |
| `PERPETUAL_EVENTS` | No         | Set to `false` to delete elapsed events instead of rolling them forward. Enabled by default.                                      |

## Ingest

```bash
npm run ingest                             # all three sources
npx tsx scripts/ingest.ts --source=gcba    # one source
npx tsx scripts/ingest.ts --migrate --seed # migrations, venue seed, then ingest
```

| Flag            | Effect                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| `--source=<id>` | `gcba`, `eventbrite` or `alternativa`. Defaults to `all`.                   |
| `--migrate`     | Applies every `*.sql` file in `supabase/migrations/` in alphabetical order. |
| `--seed`        | Upserts the curated CABA venue list (`src/ingest/venues-seed.ts`).          |

The CLI enriches up to 80 new Alternativa shows per run. The cron endpoint uses 25 and the on-demand refresh uses 18.

In production, `vercel.json` schedules the three sources at 08:00, 08:20 and 08:40 UTC (05:00 to 05:40 in Buenos Aires) and calls `/api/cron/<source>` with `Authorization: Bearer $CRON_SECRET`. On any other host, point a cron job at the same endpoint.

There is a second path. Every request to `/api/events` calls `ensureFreshEvents()`, which at most once every three minutes updates the schedule and, when the newest ingest run is more than 30 minutes old, starts one source in the background in round-robin order. It is a safety net for deploys without cron, not a replacement for it: the state lives in memory, so it does nothing on serverless platforms.

### About `PERPETUAL_EVENTS`

Perpetual mode is the default. Any event that started more than two hours ago is moved forward in whole 7-day steps, large enough to land in the future, which keeps weekday and time intact. This keeps the map populated between ingest runs, but it also shows future occurrences that the sources never published.

Set `PERPETUAL_EVENTS=false` for an agenda that only reflects published dates: elapsed events are deleted once they finished more than 24 hours ago.

## API

| Endpoint                | Description                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events`       | GeoJSON `FeatureCollection`. Query params: `when` (`now`, `today`, `weekend` or `YYYY-MM-DD`), `cat` (comma-separated category ids), `price` (`free`, `eco`, `mod`, `premium`), `q` (up to 80 characters). |
| `GET /api/events/:id`   | Full record plus the upcoming showtimes of the same production (up to 10).                                                                                                                                 |
| `GET /api/cron/:source` | Runs the ingest for one source. Requires `CRON_SECRET`; returns 400 for an unknown source.                                                                                                                 |
| `GET /api/health`       | Database status. Returns 503 with the reason when `DATABASE_URL` is missing or Postgres does not answer.                                                                                                   |

`/api/events` returns one feature per `group_key`, capped at 1200 features. Without `when` it covers the next 30 days. `price=eco` includes free events. Responses are cached for 180 seconds with `stale-while-revalidate=600`; the detail endpoint uses 300 and 900.

## Deploy

1. Create a Postgres database and run `npx tsx scripts/ingest.ts --migrate --seed --source=all` against it.
2. Import the repository into Vercel or any Node host and set `DATABASE_URL` and `CRON_SECRET`.
3. Schedule the ingest. `vercel.json` already does it on Vercel; elsewhere call `/api/cron/gcba`, `/api/cron/eventbrite` and `/api/cron/alternativa` with the authorization header.

Nothing in the critical path is proprietary. A Postgres instance and a cron entry are enough; Supabase and Vercel are conveniences, not requirements.

## Project layout

```
src/app/              routes, layout and API endpoints (App Router)
src/components/       map, filters, listing and event sheet
src/ingest/           sources, normalisation, geocoding and upsert
src/lib/              database client, domain constants, formatting and favourites
scripts/ingest.ts     ingest and migration CLI
supabase/migrations/  SQL schema
docs/                 architecture, data sources and screenshots
```

More detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

## Data sources & attribution

| Source              | Content                                                              | Access                                       |
| ------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| GCBA agenda (Linda) | Museums, cultural centres, parks and public spaces of the City       | Public JSON API behind the official site     |
| Alternativa Teatral | Theatre, dance and music listings, including the independent circuit | JSONP feed that requires a session cookie    |
| Eventbrite          | In-person events published in Buenos Aires                           | Listing HTML plus the public destination API |

Event data belongs to its publishers. The project always links to the original page of each event and does not redistribute full content. Cartography comes from [OpenStreetMap](https://www.openstreetmap.org/copyright) and from the [official GCBA map (USIG)](https://servicios.usig.buenosaires.gob.ar). Terms of use and scraping notes for each source are in [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first and run `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test` before opening a PR.

Good first issues:

- Parser tests with saved fixtures. All three sources change their markup without notice, and the existing tests only cover GCBA and the normaliser.
- Real clustering by zoom level instead of the current per-zoom cutoff (120 pins at zoom 15 and above, 80 from 13.6, 48 below).
- New sources: CCK, neighbourhood cultural centres, universities.
- Accessibility of the listing and of the map popover: keyboard navigation, focus order, screen reader labels.

Internals and known limits are described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT. See [`LICENSE`](LICENSE).
