# Contributing

Thanks for taking the time. This project is small and maintained by one person, so the most useful contributions come with context: an issue that reproduces a problem, or a pull request limited to one change.

## Before you start

- Search the open issues to see whether it has already been reported.
- For larger changes (a new source, a refactor of the data layer) open an issue first and discuss the approach.
- For typos, docs or small fixes, send the pull request directly.

## Setup

```bash
git clone https://github.com/Juan-Martin-Cerezo/que-hay-ba.git
cd que-hay-ba
npm install
cp .env.example .env.local
npm run db:setup
npm run dev
```

Node 20 or newer. The app needs a Postgres database; a local instance or a Supabase project both work.

## Required checks

All of them run in CI. A pull request with a failing check is not merged.

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

To verify the full build: `npm run build`.

## Style

- Strict TypeScript, no new `any`.
- Components and helpers in English, interface copy in Rioplatense Spanish.
- No new dependencies when the problem can be solved with what is already there.
- Comments only where they explain a reason that the code does not show.

## Pull requests

- One topic per PR. If you touched two things, send two.
- Describe the problem before the solution, and how you tested it.
- If you touched a parser, add or update the test with a fixture of the real HTML.
- If you touched the schema, add a new migration in `supabase/migrations/` instead of editing existing ones.

## Reporting bugs

Include:

- What you expected to happen and what happened.
- Steps to reproduce it.
- The event URL or a screenshot if it is a data issue.
- Logs or the endpoint output if it is about ingest.

## Data and sources

Do not commit full scrapes or third-party content to the repository. For tests, keep the smallest HTML fragment that covers the case. If a source changes its markup, an issue is welcome: they tend to break without notice.
