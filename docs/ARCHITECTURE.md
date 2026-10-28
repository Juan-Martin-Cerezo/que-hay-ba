# Architecture

The application has two halves that share one Postgres database: an ingest pipeline that runs on a schedule and a frontend that reads through HTTP. The web process holds no state beyond the connection pool.

```
external sources ──► src/ingest ──► Postgres ──► /api/events ──► React + MapLibre
   (3 sites)          parsers,        tables        GeoJSON
                    normalisation,    events,
                    geocoding         venues…
```

## Data model

| Table           | Role                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `events`        | One row per showtime. `dedup_key` is unique; `group_key` groups repeat performances of the same production at the same room. |
| `venues`        | Venues with coordinates. `key` is a normalised `name\|address` pair.                                                         |
| `detail_cache`  | Enriched record per production (price, synopsis) so the detail page is not fetched twice.                                    |
| `geocode_cache` | Address to coordinates, so the same address is never geocoded again. Misses expire after 30 days.                            |
| `ingest_runs`   | One row per run with counters and error message. This is the health history of the pipeline.                                 |

All five tables have row level security enabled and no policies: the app connects with the service role and every query goes through the server. There is no anonymous access to the database.

## Ingest

`src/ingest/run.ts` orchestrates: it fetches raw events from the source, resolves the venue, normalises price and category, and issues `insert ... on conflict (dedup_key) do update`. The upsert never overwrites good data. `description`, `image_url` and `tickets_url` only fill in through `coalesce`, `is_free` accumulates with `or`, and `sources` collects every source that saw the same event. Each run opens a row in `ingest_runs` before fetching and closes it with counters (`fetched`, `upserted`, `pruned`) or with the error message truncated to 500 characters.

Known venues are preloaded into a map before the loop, so only new venues trigger a geocoding call.

Each source implements the same contract (`RawEvent` in `src/ingest/types.ts`):

| File                     | Origin                              | Strategy                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sources/gcba.ts`        | Linda public API (GCBA)             | Paginated JSON. Uses `fechasDelEvento` and emits up to three upcoming occurrences per event within a window of 6 hours back and 45 days ahead. Long-running exhibitions whose start date has passed are anchored to today at 14:00 ART when `fechaFin` is still in the future. Rewrites `/descubrir/` to `/eventos/`, the path the API still advertises incorrectly. |
| `sources/alternativa.ts` | Alternativa Teatral listings        | Requests `cartelera.asp` to obtain session cookies, reads the JSONP feed from `get-json.php`, and enriches uncached CABA productions from their individual page in batches of six. Results are stored in `detail_cache`.                                                                                                                                             |
| `sources/eventbrite.ts`  | Eventbrite public destination pages | Reads ten listing pages for Buenos Aires, extracts the `window.__SERVER_DATA__` blob from each, then enriches 40 ids at a time through the public destination API (`ticket_availability,primary_venue,image`). Events without valid CABA coordinates are dropped.                                                                                                    |

GCBA is fetched with a single request. Linda ignores the `limit` parameter and returns the same payload for every page, so the pagination loop is kept only for the day that changes. Each page is retried three times; if no usable event survives the run throws instead of writing a partial result.

Terms, attribution and fragility of each source are documented in [`DATA-SOURCES.md`](DATA-SOURCES.md).

## Normalisation

`src/ingest/normalise.ts` holds the rules:

- **Categories**: six (`musica`, `teatro`, `arte`, `gastronomia`, `aire_libre`, `talleres`). A weighted keyword match runs over source tags, title and the first 600 characters of the description; source tags and titles score double. When nothing matches, each source has a default (`gcba` → `arte`, `alternativa` → `teatro`, `eventbrite` → `talleres`).
- **Prices**: explicit source fields win. Otherwise the text is scanned for ARS amounts (`$ 10.000`, `$8.000 / $12.000`, `ARS 25.000`), free text is detected in Spanish (`gratis`, `entrada libre`, `a la gorra` and similar), and the result becomes `price_min` / `price_max`.
- **Deduplication**: `dedup_key` is a SHA-1 of normalised title, venue key and a 30-minute bucket. `group_key` is title plus venue, without time.
- **Venue keys**: a street name and number when the address has both (`addr:<street>:<number>`), otherwise a truncated normalised name. Titles and addresses are lowercased, stripped of accents and of generic words such as `teatro`, `sala` or `avenida`.
- **Dates**: sources publish local time without an offset. Everything is read as ART (fixed UTC-3, Argentina has had no daylight saving since 2009) and stored in UTC.

## Geocoding

`src/ingest/geocode.ts` resolves in cascade and stops at the first hit:

1. Coordinates supplied by the source, validated against the CABA bounding box (`-34.706..-34.526`, `-58.532..-58.334`).
2. Curated venue catalogue (`venues-seed.ts`), matched by normalised name, by `name|address` key, or by an explicit alias.
3. `geocode_cache`. Stored hits are reused forever; stored misses are retried after 30 days.
4. USIG, the GCBA address normaliser and geocoder, with the province suffix stripped from the query.
5. Nominatim, bounded to the city viewbox and throttled to one request per second as its usage policy requires.

Every result is checked against the bounding box before it is accepted. If nothing resolves, the event is skipped: coordinates are never estimated.

## API

- `GET /api/events` returns a `FeatureCollection` with `total` and the resolved `window`. It filters by time window (`computeTimeWindow()`), category, price bucket and text (`title`, venue name, neighbourhood, description), then applies `distinct on (group_key)` ordered by `starts_at` to keep one showtime per production. The 1200-row result is sorted chronologically in memory. Events that share exact coordinates get a deterministic golden-angle offset of at most ~30 m so overlapping pins stay clickable.
- `GET /api/events/:id` validates the id, returns the full record and up to 10 upcoming showtimes of the same `group_key` from two hours ago onwards.
- `GET /api/cron/:source` runs one source. It compares the `Authorization` header against `CRON_SECRET` with a timing-safe digest comparison, returns 401 when the variable is unset or the header does not match, and 400 for an unknown source. It seeds venues first and caps the run at 60 seconds.
- `GET /api/health` returns `{ ok, events }` or a 503 with the reason.

Each request to `/api/events` calls `ensureFreshEvents()`, which at most once every three minutes runs the schedule refresh and, when the newest `ingest_runs` row is older than 30 minutes, starts one source in the background in round-robin order. If one is already running, the call is skipped.

## Frontend

`ExploreClient` is the container: it holds filters, selection and favourites, and refetches events every 60 seconds and whenever the tab becomes visible again. The listing shows 120 entries, ordered chronologically by default, free first, or by distance from the browser location.

`MapView` builds markers as HTML elements rather than WebGL layers, which keeps them styleable with CSS and accessible as buttons. Markers are grouped by venue; a venue with more than one event opens a stacked popover listing all of them. Pins are limited to the current viewport and to a zoom-dependent cap (120 at zoom 15 and above, 80 from 13.6, 48 below) with the selected and hovered venues always kept.

Favourites live in `localStorage`, with no account and no backend.

## Known limits

- Ingest depends on HTML and undocumented APIs from third parties. When they change, it breaks; parser tests are the defence, and coverage is still partial.
- The perpetual mode of `PERPETUAL_EVENTS` produces future occurrences of elapsed events that the sources never published. It is documented, configurable and off by saying so.
- `ensureFreshEvents()` keeps state in module memory. With several instances, each one can start its own ingest. A dedicated worker or a single cron is the right answer for serious production use.
- The listing is capped at 1200 events. That covers CABA; growth would need pagination.
- There is no real clustering by zoom: pins are cut by count to avoid saturating the view.
- Geocoding of new venues happens inside the request that discovers them, which is why a cold ingest is slow.
