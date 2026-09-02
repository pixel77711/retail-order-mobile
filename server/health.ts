import { sql } from "drizzle-orm";

import { getDb } from "./db";

export async function getReadiness() {
  const db = await getDb();
  if (!db) return { ok: false, database: "unavailable" as const };

  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, database: "ready" as const };
  } catch {
    return { ok: false, database: "unreachable" as const };
  }
}
