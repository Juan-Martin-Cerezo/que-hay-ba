import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 503 }
    );
  }

  try {
    const [row] = await sql()<{ events: number }[]>`
      select count(*)::int as events from events
    `;
    return NextResponse.json({ ok: true, events: row.events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown database error";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
