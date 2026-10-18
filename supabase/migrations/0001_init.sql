-- Qué Hay BA — initial schema.
-- The app talks to Postgres from the server only (service connection string).
-- RLS is enabled with NO policies so Supabase's public anon/authenticated roles
-- cannot read or write anything through PostgREST.

create table if not exists venues (
  id            serial primary key,
  key           text not null unique,           -- normalised name|address
  name          text not null,
  address       text,
  barrio        text,
  lat           double precision not null,
  lng           double precision not null,
  created_at    timestamptz not null default now()
);

create table if not exists events (
  id            serial primary key,
  dedup_key     text not null unique,           -- title|venue|start (30 min bucket)
  group_key     text not null,                  -- title|venue (collapses recurring functions)
  title         text not null,
  description   text,
  image_url     text,
  url           text not null,                  -- official page
  tickets_url   text,
  source        text not null,                  -- source of record
  source_id     text not null,
  sources       jsonb not null default '[]'::jsonb, -- [{source,url}] when merged
  category      text not null,
  is_free       boolean not null default false,
  price_min     integer,                        -- ARS, null = unknown
  price_max     integer,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  venue_id      integer not null references venues(id) on delete cascade,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists events_starts_at_idx on events (starts_at);
create index if not exists events_category_idx on events (category);
create index if not exists events_group_idx on events (group_key, starts_at);
create index if not exists events_source_idx on events (source, last_seen_at);

-- Per-show enrichment cache (e.g. Alternativa Teatral price + synopsis).
create table if not exists detail_cache (
  source        text not null,
  source_id     text not null,
  is_free       boolean,
  price_min     integer,
  price_max     integer,
  description   text,
  checked_at    timestamptz not null default now(),
  primary key (source, source_id)
);

-- Address → coordinates cache for the geocoding fallback.
create table if not exists geocode_cache (
  query         text primary key,
  lat           double precision,
  lng           double precision,
  checked_at    timestamptz not null default now()
);

create table if not exists ingest_runs (
  id            serial primary key,
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  fetched       integer default 0,
  upserted      integer default 0,
  pruned        integer default 0,
  error         text
);

alter table venues        enable row level security;
alter table events        enable row level security;
alter table detail_cache  enable row level security;
alter table geocode_cache enable row level security;
alter table ingest_runs   enable row level security;
