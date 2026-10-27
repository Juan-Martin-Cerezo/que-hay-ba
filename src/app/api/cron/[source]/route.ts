import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ingestSource, seedVenues } from "@/ingest/run";
import type { SourceId } from "@/ingest/types";

export const maxDuration = 60;

const VALID_SOURCES = new Set<SourceId>(["gcba", "eventbrite", "alternativa"]);

function matchesSecret(header: string | null, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return header !== null && timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ source: string }> }
) {
  // Fail closed: an unset CRON_SECRET must not turn the ingest into a public endpoint.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || !matchesSecret(authHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await ctx.params;
  const normalized = (source === "alternativa-teatral" ? "alternativa" : source) as SourceId;
  if (!VALID_SOURCES.has(normalized)) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
  }

  await seedVenues();
  const summary = await ingestSource(normalized, { enrichLimit: 25 });
  return NextResponse.json({ ok: true, ...summary });
}
