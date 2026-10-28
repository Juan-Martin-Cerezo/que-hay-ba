# Data sources

Three sources, all public and none of them requiring an API key. None of them is designed as a third-party API: these are the endpoints their own sites use. They can change without notice, and they should be queried in moderation.

## GCBA: official agenda (Linda)

- **Endpoint**: `https://linda.buenosaires.gob.ar/api/frontend/events/filter?page=N&limit=50`
- **Content**: activities at museums, cultural centres, parks and public spaces of the City, with date, address, coordinates, price and tags.
- **Parser**: `src/ingest/sources/gcba.ts`. One request per run. Linda ignores `limit` and returns the whole agenda for every page, so there is nothing to gain from paging right now; the loop stays in case that changes.
- **Occurrences**: up to three upcoming dates per event, taken from `fechasDelEvento`, within 6 hours back and 45 days ahead.
- **Detail**: the API returns `pathAlias` as `/descubrir/<slug>`, but that route no longer exists. The real page is `/eventos/<slug>` and the parser rewrites it.
- **Attribution**: content belongs to the Government of the City of Buenos Aires. Every event links to its official page.

## Alternativa Teatral

- **Content**: theatre, dance and music listings in CABA venues, independent circuit included, with prices and synopses.
- **Parser**: `src/ingest/sources/alternativa.ts`. It first requests `cartelera.asp` to obtain session cookies, then reads the JSONP feed from `get-json.php`. Each production is enriched from its individual page and cached in `detail_cache`.
- **Why it works this way**: the listing has no stable public JSON; the site expects a session. The parser fetches each new production once and reuses the cached detail afterwards, in batches of six with a per-run limit.
- **Attribution**: data belongs to Alternativa Teatral. Links go to the original page.

## Eventbrite

- **Content**: in-person events published in Buenos Aires, with price ranges and availability.
- **Parser**: `src/ingest/sources/eventbrite.ts`. It reads ten public listing pages (general, free, music, food and drink, arts), extracts the `window.__SERVER_DATA__` payload embedded in each, and enriches the collected ids through the public destination API. Online and cancelled events are dropped.
- **Attribution**: events belong to their organisers; links go to the Eventbrite page.

## Cartography

- **OpenStreetMap**: tiles from `tile.openstreetmap.org`, attribution to © OpenStreetMap contributors is required. The [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) asks for moderate use; at higher traffic, use your own tile provider.
- **USIG (GCBA)**: `servicios.usig.buenosaires.gob.ar` for the official base map and for address normalisation.

## Before deploying at scale

- Read the terms of each site. This repository automates the reading of public pages for personal and educational use; a commercial service needs permission or an agreement with each source.
- Do not increase the frequency beyond what the data justifies. Three ingests per day are enough because these agendas do not change hourly.
- Store only what is needed to display the event and link back to the source. Do not redistribute full content.
- If a source returns 403 or blocks the user agent, the correct response is to ask for access, not to work around the block.
