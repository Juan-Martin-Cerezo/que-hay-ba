# Qué Hay BA — Mapa Interactivo de Actividades y Eventos en CABA

Plataforma web interactiva en tiempo real que reúne la agenda cultural, teatral, musical, gastronómica y recreativa de la Ciudad Autónoma de Buenos Aires (CABA).

## Características principales

- **Mapa interactivo (MapLibre GL + OpenFreeMap):** agrupación inteligente (*clusters*) por concentración barrial y pines codificados por color según la categoría.
- **Datos reales multi-fuente:**
  - **Agenda Cultural GCBA (`linda.buenosaires.gob.ar`):** museos, centros culturales, visitas guiadas, festivales y actividades gratuitas.
  - **Alternativa Teatral:** cartelera escénica de CABA con horarios, salas, precios y sinopsis.
  - **Eventbrite CABA:** talleres, conferencias, recitales, ferias y eventos comunitarios con precios reales en ARS.
- **Deduplicación y geocodificación:** normalización automática de salas y direcciones mediante caché local de 62 espacios culturales emblemáticos, el normalizador oficial **USIG GCBA** (`srid=4326`) y Nominatim acotado al polígono de CABA.
- **Filtros combinables:**
  - **Tiempo:** `🟢 En vivo ahora`, `📅 Hoy`, `🗓️ Este finde` y selector de fecha específica (`📆`).
  - **Presupuesto:** `🎟️ Gratis`, `Hasta $10.000`, `$10.000 – $30.000`, `Más de $30.000`.
  - **Categorías:** Música, Teatro y Espectáculos, Arte y Cultura, Gastronomía y Ferias, Aire Libre y Deportes, Talleres y Charlas.
- **Ficha completa del evento:** imagen, descripción, próximas funciones, botón **Cómo llegar** (Google Maps) y enlace directo a la **Web oficial / Entradas**.
- **Favoritos y geolocalización:** guardado persistente en `localStorage` (`❤️ Favoritos`) y ordenamiento por cercanía (`📍 Mi ubicación`).

## Comandos

```bash
# Ejecutar migración SQL, sembrar las 62 sedes de CABA e ingerir las 3 fuentes reales
npm run db:setup

# Actualizar eventos desde todas las fuentes (o una específica: --source=gcba|eventbrite|alternativa)
npm run ingest

# Ejecutar tests unitarios, chequeo de tipos, linter y build de producción
npm test
npm run typecheck
npm run lint
npm run build
```

## Variables de entorno (`.env.local` / Vercel)

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
CRON_SECRET=tu-secreto-para-vercel-cron
```
