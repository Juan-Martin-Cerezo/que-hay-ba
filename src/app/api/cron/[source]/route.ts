import { NextResponse, type NextRequest } from "next/server";
import { ALL_SOURCES, ingestSource, seedVenues } from "@/ingest/run";
import type { SourceId } from "@/ingest/types";

export const maxDuration = 60;

const VALID_SOURCES = new Set<SourceId>(ALL_SOURCES);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ source: string }> }
) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await ctx.params;
  await seedVenues();

  if (source === "all") {
    const results = [];
    for (const s of ALL_SOURCES) {
      try {
        const summary = await ingestSource(s, { enrichLimit: 18 });
        results.push({ ok: true, ...summary });
      } catch (err) {
        results.push({ ok: false, source: s, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  const normalized = (source === "alternativa-teatral" ? "alternativa" : source) as SourceId;
  if (!VALID_SOURCES.has(normalized)) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
  }

  const summary = await ingestSource(normalized, { enrichLimit: 25 });
  return NextResponse.json({ ok: true, ...summary });
}
