# Security

## Reporting a vulnerability

Write to juanmartincerezo@gmail.com with the details and, if possible, a proof of concept. Do not open a public issue. You will get an answer within five days.

## Scope

- API and cron endpoints.
- Database queries and data exposure.
- Dependencies with known vulnerabilities.

## Out of scope

- Content of the external sources (GCBA, Alternativa Teatral, Eventbrite).
- Attacks that require physical access or deployment credentials.

## Notes for deployers

- Set `CRON_SECRET`. Without it `/api/cron/:source` returns 401 and ingest cannot be triggered over HTTP.
- Use a database with row level security, or a Postgres user limited to the application schema. The shipped migrations enable RLS on every table without policies, which is intended for the service-role connection the app uses.
- Never expose `DATABASE_URL` to the client. All queries run on the server.
