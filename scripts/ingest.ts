import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { ALL_SOURCES, ingestSource, seedVenues } from "../src/ingest/run";
import type { SourceId } from "../src/ingest/types";
import { sql } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const migrate = args.includes("--migrate");
  const seed = args.includes("--seed");
  const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "all";

  const db = sql();

  if (migrate) {
    const dir = join(process.cwd(), "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await db.unsafe(readFileSync(join(dir, file), "utf8"));
      console.log(`✓ Applied supabase/migrations/${file}`);
    }
  }

  if (seed) {
    const seeded = await seedVenues();
    console.log(`✓ Seeded ${seeded} CABA venues`);
  }

  const sources: SourceId[] =
    sourceArg === "all"
      ? ALL_SOURCES
      : ([sourceArg] as SourceId[]);

  for (const s of sources) {
    console.log(`→ Ingesting ${s}...`);
    try {
      const summary = await ingestSource(s, { enrichLimit: 80 });
      console.log(
        `✓ ${summary.source}: fetched=${summary.fetched} upserted=${summary.upserted} pruned=${summary.pruned} (${summary.durationMs}ms)`
      );
    } catch (err) {
      console.error(`✗ ${s} failed:`, err instanceof Error ? err.message : err);
    }
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
