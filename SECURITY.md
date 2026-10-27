# Seguridad

## Reportar una vulnerabilidad

Escribí a juanmartincerezo@gmail.com con el detalle y, si podés, una prueba de concepto. No abras un issue público. Respondo dentro de los cinco días.

## Alcance

- Endpoints de la API y del cron.
- Consultas a la base y exposición de datos.
- Dependencias con vulnerabilidades conocidas.

## Fuera de alcance

- Contenido de las fuentes externas (GCBA, Alternativa Teatral, Eventbrite).
- Ataques que requieran acceso físico o credenciales del deploy.

## Buenas prácticas para quien deploya

- Definí `CRON_SECRET`. Sin esa variable, `/api/cron/:source` responde 401 y la ingesta no se dispara desde HTTP.
- Usá una base con RLS o un usuario de Postgres acotado al schema de la app.
- No expongas `DATABASE_URL` al cliente: todas las consultas pasan por el servidor.
