import { DurableObject } from 'cloudflare:workers'

// Counts the workspaces made each UTC day. Every create in every location goes through the one
// instance, one at a time, so unlike the rate limits the count is exact.
export class Quota extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS creates (day TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
    )
  }

  // Takes one of the day's creates, if the limit leaves one.
  take(day: string, limit: number): boolean {
    const sql = this.ctx.storage.sql
    const [row] = sql
      .exec<{ count: number }>(`SELECT count FROM creates WHERE day = ?`, day)
      .toArray()
    if ((row?.count ?? 0) >= limit) return false
    sql.exec(`DELETE FROM creates WHERE day <> ?`, day)
    sql.exec(
      `INSERT INTO creates VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET count = count + 1`,
      day,
    )
    return true
  }
}
