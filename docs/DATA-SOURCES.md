# Fuentes de datos

Tres fuentes, todas públicas y sin API key. Ninguna está pensada como API de terceros: son los endpoints que usan sus propios sitios. Eso implica que pueden cambiar sin aviso y que conviene consultarlas con moderación.

## GCBA — agenda oficial (Linda)

- **Endpoint**: `https://linda.buenosaires.gob.ar/api/frontend/events/filter?page=N&limit=50`
- **Qué trae**: actividades de museos, centros culturales, parques y espacios públicos de la Ciudad, con fecha, dirección, coordenadas, precio y etiquetas.
- **Parser**: `src/ingest/sources/gcba.ts`. Pagina hasta ocho páginas por corrida.
- **Detalle**: la API devuelve `pathAlias` con la forma `/descubrir/<slug>`, pero esa ruta ya no existe. La página real es `/eventos/<slug>` y el parser la reescribe.
- **Atribución**: los contenidos son del Gobierno de la Ciudad de Buenos Aires. Cada evento linkea a su página oficial.

## Alternativa Teatral

- **Qué trae**: cartelera de teatro, danza y música en salas de CABA, incluido el circuito independiente, con precios y sinopsis.
- **Parser**: `src/ingest/sources/alternativa.ts`. Primero obtiene cookies de sesión de `cartelera.asp` y después consume el JSON de la cartelera; cada obra se enriquece con su ficha individual, cacheada en `detail_cache`.
- **Por qué así**: la cartelera no expone un JSON público estable; el sitio espera una sesión. El parser hace una sola petición por obra nueva y cachea el resto.
- **Atribución**: los datos son de Alternativa Teatral. Los links van a la ficha original.

## Eventbrite

- **Qué trae**: eventos presenciales en CABA publicados en la plataforma, con rango de precios y disponibilidad.
- **Parser**: `src/ingest/sources/eventbrite.ts`. Búsqueda por bounding box de la ciudad y enriquecimiento con el endpoint público de disponibilidad de tickets.
- **Atribución**: los eventos son de sus organizadores; los links van a la página de Eventbrite.

## Cartografía

- **OpenStreetMap**: tiles de `tile.openstreetmap.org`, atribución obligatoria © OpenStreetMap contributors. La [política de uso](https://operations.osmfoundation.org/policies/tiles/) pide no abusar del servicio; para tráfico alto, usá un proveedor de tiles propio.
- **USIG (GCBA)**: `servicios.usig.buenosaires.gob.ar` para el mapa oficial y para normalizar direcciones.

## Antes de deployar a escala

- Revisá los términos de cada sitio. Este repo automatiza la lectura de páginas públicas para uso personal y educativo; un servicio comercial necesita permiso o un acuerdo con cada fuente.
- No bajes la frecuencia por debajo de lo razonable: las tres ingestas diarias alcanzan porque las agendas no cambian cada hora.
- Guardá solo lo necesario para mostrar el evento y linkear a la fuente. No redistribuyas el contenido completo.
- Si una fuente devuelve 403 o bloquea el user-agent, la respuesta correcta es pedir acceso, no evadir el bloqueo.
