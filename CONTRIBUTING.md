# Cómo contribuir

Gracias por tomarte el tiempo. Este proyecto es chico y se mantiene solo, así que los aportes más útiles son los que vienen con contexto: un issue que reproduce el problema o un PR acotado a un cambio.

## Antes de empezar

- Buscá en los issues abiertos si alguien ya lo reportó.
- Para cambios grandes (una fuente nueva, un refactor de la capa de datos) abrí un issue primero y discutimos el enfoque.
- Para typos, docs o fixes chicos, mandá el PR directo.

## Entorno

```bash
git clone https://github.com/Juan-Martin-Cerezo/que-hay-ba.git
cd que-hay-ba
npm install
cp .env.example .env.local
npm run db:setup
npm run dev
```

Node 20 o superior. La app necesita una base Postgres: sirve un Postgres local o un proyecto de Supabase.

## Checks obligatorios

Los tres corren en CI. Si alguno falla, el PR no se mergea.

```bash
npm run lint
npm run typecheck
npm test
```

Para verificar el build completo: `npm run build`.

## Estilo

- TypeScript estricto, sin `any` nuevos.
- Componentes y helpers en inglés, textos de interfaz en español rioplatense.
- Sin dependencias nuevas si el problema se resuelve con lo que ya está.
- Comentarios solo donde explican un porqué que no se lee en el código.

## Pull requests

- Un tema por PR. Si tocaste dos cosas, mandá dos.
- Describí el problema antes de la solución y cómo lo probaste.
- Si tocaste un parser, agregá o actualizá el test con un fixture del HTML real.
- Si tocaste el schema, sumá una migración nueva en `supabase/migrations/` (no edites las existentes).

## Reportar bugs

Incluí:

- Qué esperabas que pasara y qué pasó.
- Pasos para reproducirlo.
- URL del evento o captura si es un problema de datos.
- Logs o el output del endpoint si es de ingesta.

## Datos y fuentes

No subas scrapes completos ni contenido de terceros al repo. Para tests, guardá el fragmento mínimo de HTML necesario. Si una fuente cambia su markup, el issue es bienvenido: suelen romperse sin aviso.
