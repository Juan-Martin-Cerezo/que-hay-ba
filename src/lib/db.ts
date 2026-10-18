import postgres from "postgres";

declare global {
  var __sql: postgres.Sql | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    ssl: isLocal ? false : "require",
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

// Lazy singleton: avoids exhausting connections across hot reloads / warm lambdas.
export function sql(): postgres.Sql {
  if (!globalThis.__sql) globalThis.__sql = create();
  return globalThis.__sql;
}
