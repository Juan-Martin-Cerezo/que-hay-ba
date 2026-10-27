# Arquitectura

La app tiene dos mitades que comparten la misma base Postgres: un pipeline de ingesta que corre por cron y un frontend que lee por HTTP. No hay estado en el servidor web más allá del pool de conexiones.

```
fuentes externas ──► src/ingest ──► Postgres ──► /api/events ──► React + MapLibre
   (3 sitios)         parsers,        tablas        GeoJSON
                    normalización,   events,
                    geocoding        venues…
```

## Modelo de datos

| Tabla           | Rol                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `events`        | Un registro por función. `dedup_key` único, `group_key` agrupa las repeticiones de la misma obra en la misma sala. |
| `venues`        | Sedes con coordenadas. `key` es `nombre\|dirección` normalizado.                                                   |
| `detail_cache`  | Ficha enriquecida por función (precio, sinopsis) para no repetir el fetch.                                         |
| `geocode_cache` | Dirección → coordenadas, para no volver a geocodificar.                                                            |
| `ingest_runs`   | Una fila por corrida, con contadores y error. Es el histórico de salud del pipeline.                               |

Las cinco tablas tienen RLS activo y sin políticas: la app se conecta con el rol de servicio y todo el tráfico pasa por el servidor. No hay acceso anónimo a la base.

## Ingesta

`src/ingest/run.ts` orquesta: pide los eventos crudos a la fuente, resuelve la sede, normaliza precio y categoría, y hace `insert ... on conflict (dedup_key) do update`. El upsert no pisa lo que ya está bueno: `description`, `image_url` y `tickets_url` solo se completan con `coalesce`, y `sources` acumula las fuentes que vieron el mismo evento.

Cada fuente implementa el mismo contrato (`RawEvent` en `src/ingest/types.ts`) y tiene su propio parser:

| Archivo                  | Origen                                | Estrategia                                                                                                                                                                   |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sources/gcba.ts`        | API pública de Linda (GCBA)           | JSON paginado. Usa `fechasDelEvento` y, para muestras largas, ancla la función al día de hoy. Reescribe `/descubrir/` a `/eventos/`, la ruta que la API todavía anuncia mal. |
| `sources/alternativa.ts` | Cartelera de Alternativa Teatral      | Abre sesión en `cartelera.asp`, pide el JSON de la cartelera y enriquece cada obra con su ficha individual, con caché en `detail_cache`.                                     |
| `sources/eventbrite.ts`  | API pública de destinos de Eventbrite | Búsqueda por bounding box de CABA, enriquece precios con el endpoint de disponibilidad.                                                                                      |

Detalle de términos, atribución y fragilidad de cada fuente en [`DATA-SOURCES.md`](DATA-SOURCES.md).

## Normalización

`src/ingest/normalise.ts` concentra las reglas:

- **Categorías**: seis (`musica`, `teatro`, `arte`, `gastronomia`, `aire-libre`, `talleres`). Se clasifica por palabras clave en título, descripción y etiquetas de origen, con una categoría por defecto según la fuente.
- **Precios**: extrae montos en ARS (`$ 10.000`, `$8.000 / $12.000`, `ARS 25.000`), detecta gratuidad por texto y por campo de la fuente, y arma el rango `price_min`/`price_max`.
- **Deduplicación**: `dedup_key` = título normalizado + sede + franja de 30 minutos. `group_key` = título + sede, sin tiempo.
- **Fechas**: las fuentes publican hora local sin offset. Todo se interpreta como ART (UTC-3 fijo, Argentina no tiene horario de verano desde 2009) y se guarda en UTC.

## Geocodificación

`src/ingest/geocode.ts` resuelve en cascada y corta en el primer acierto:

1. Coordenadas que ya trae la fuente, validadas contra el bounding box de CABA.
2. Catálogo curado de sedes (`venues-seed.ts`).
3. `geocode_cache`.
4. Normalizador oficial USIG del GCBA.
5. Nominatim de OpenStreetMap, con el resultado validado contra el polígono de la ciudad.

Si nada resuelve, el evento se descarta: no se inventan coordenadas.

## API

- `GET /api/events` devuelve un `FeatureCollection`. Filtra por ventana temporal, categoría, rango de precio y texto; la ventana la calcula `computeTimeWindow()`. Ordena por `group_key` con `distinct on` para mostrar una función por grupo, y después ordena cronológicamente en memoria.
- `GET /api/events/:id` devuelve la ficha completa y las próximas funciones de la misma obra.
- `GET /api/cron/:source` corre la ingesta de una fuente. Requiere `Authorization: Bearer $CRON_SECRET`; sin la variable configurada responde 401.

Cada request a `/api/events` llama a `ensureFreshEvents()`, que como mucho una vez cada tres minutos reprograma eventos vencidos y, si la última ingesta tiene más de 30 minutos, dispara una fuente en segundo plano. Es una red de seguridad para deploys sin cron; con las tareas programadas andando, no hace falta.

## Frontend

`ExploreClient` es el contenedor: guarda filtros, selección y favoritos, y pide eventos cada 60 segundos. `MapView` crea los marcadores como elementos HTML (no capas WebGL) para poder estilarlos con CSS, agrupa por sede y abre un popover cuando una sede tiene más de un evento. En el servidor se aplica un corrimiento determinístico en espiral áurea cuando dos eventos comparten coordenadas exactas, para que los pines no queden perfectamente apilados.

Los favoritos viven en `localStorage`, sin cuenta ni backend.

## Límites conocidos

- La ingesta depende de HTML y APIs no documentadas de terceros: cuando cambian, se rompe. Los tests de parser son la defensa.
- El modo perpetuo de `PERPETUAL_EVENTS` inventa ocurrencias futuras de eventos vencidos. Está documentado y se puede apagar.
- `ensureFreshEvents()` usa estado en memoria por instancia. Con varias instancias, cada una puede disparar su propia ingesta. Para producción seria conviene mover la ingesta a un worker o a un cron único.
- El listado tiene un tope de 1200 eventos. Alcanza para CABA; si el proyecto crece, hay que paginar.
- Sin clustering real por zoom: los pines se recortan por cantidad para no saturar la vista.
