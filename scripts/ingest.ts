import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { ingestSource, seedVenues } from "../src/ingest/run";
import type { SourceId } from "../src/ingest/types";
import { sql } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const migrate = args.includes("--migrate");
  const seed = args.includes("--seed");
  const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "all";

  const db = sql();

  if (migrate) {
    const migrationSql = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8");
    await db.unsafe(migrationSql);
    console.log("✓ Applied supabase/migrations/0001_init.sql");
  }

  if (seed) {
    const seeded = await seedVenues();
    console.log(`✓ Seeded ${seeded} CABA venues`);
  }

  const sources: SourceId[] =
    sourceArg === "all"
      ? ["gcba", "eventbrite", "alternativa"]
      : ([sourceArg] as SourceId[]);

  for (const s of sources) {
    console.log(`→ Ingesting ${s}...`);
    const summary = await ingestSource(s, { enrichLimit: 80 });
    console.log(
      `✓ ${summary.source}: fetched=${summary.fetched} upserted=${summary.upserted} pruned=${summary.pruned} (${summary.durationMs}ms)`
    );
  }

  const [totals] = await db<{ events: number; venues: number }[]>`
    select
      (select count(*)::int from events) as events,
      (select count(*)::int from venues) as venues
  `;
  console.log(`Total in DB: ${totals.events} events across ${totals.venues} venues.`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
