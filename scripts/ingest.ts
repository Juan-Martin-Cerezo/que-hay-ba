import { readdirSync, readFileSync } from "node:fs";
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
    const dir = join(process.cwd(), "supabase/migrations");
    // Migrations are written to be re-runnable, so every deploy applies all of them in order.
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      await db.unsafe(readFileSync(join(dir, file), "utf8"));
      console.log(`✓ Applied supabase/migrations/${file}`);
    }
  }

  if (seed) {
    const seeded = await seedVenues();
    console.log(`✓ Seeded ${seeded} CABA venues`);
  }

  const sources: SourceId[] =
    sourceArg === "all" ? ["gcba", "eventbrite", "alternativa"] : ([sourceArg] as SourceId[]);

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
