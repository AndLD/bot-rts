import { createTestDatabase, TestDatabase } from './test-database'

// Index verification (Phase 8.5): with sequential scans switched off, the planner can only answer a query from an index if one
// serves it, so a query that reports a "Seq Scan" here has no usable index. The tables are empty; the plan is what counts.
let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
afterAll(() => database.drop())

const UUID = '00000000-0000-4000-8000-000000000001'

const QUERIES: Record<string, string> = {
  'cells of a map area': `SELECT * FROM map_points WHERE x BETWEEN 0 AND 15 AND y BETWEEN 0 AND 15 AND z BETWEEN 0 AND 0 ORDER BY x, y, z`,
  'bases in a map area': `SELECT * FROM map_points WHERE type IN ('base', 'corpse_base') AND x BETWEEN 0 AND 60 AND y BETWEEN 0 AND 60`,
  'the number of bases': `SELECT count(*) FROM map_points WHERE type IN ('base', 'corpse_base')`,
  'the cell of a base or bot': `SELECT * FROM map_points WHERE content_id = '${UUID}'`,
  'what a player knows of an area': `SELECT * FROM known_points WHERE user_id = '${UUID}' AND x BETWEEN 0 AND 15 AND y BETWEEN 0 AND 15`,
  'bases of a player': `SELECT * FROM bots WHERE user_id = '${UUID}' AND type = 'base'`,
  'bots of a base': `SELECT * FROM bots WHERE base_id = '${UUID}'`,
  'modules of a bot': `SELECT * FROM modules WHERE bot_id = '${UUID}' ORDER BY id`,
  'files of a drive': `SELECT * FROM files WHERE drive_id = '${UUID}' AND path = 'main.js'`,
  'items a bot carries': `SELECT * FROM items WHERE bot_id = '${UUID}'`,
  'executions to relaunch': `SELECT * FROM executions WHERE status = 'active' ORDER BY created_at`,
  'executions of a player': `SELECT * FROM executions WHERE user_id = '${UUID}' AND status = 'active'`,
  'newest terminal lines of a bot': `SELECT * FROM terminal_logs WHERE bot_id = '${UUID}' ORDER BY at DESC LIMIT 100`,
  'terminal lines past retention': `DELETE FROM terminal_logs WHERE at < now()`,
  'sessions of a bot': `SELECT * FROM terminal_sessions WHERE bot_id = '${UUID}' ORDER BY started_at DESC LIMIT 1`,
  'notifications of a player': `SELECT * FROM player_notifications WHERE user_id = '${UUID}' ORDER BY created_at DESC LIMIT 50`,
  'notifications due': `SELECT * FROM player_notifications WHERE delivered_at IS NULL AND created_at < now()`,
  'a login by its token hash': `SELECT * FROM sessions WHERE refresh_token_hash = 'x'`,
  'the logins of a player': `SELECT * FROM sessions WHERE user_id = '${UUID}'`,
  'an identity by provider and subject': `SELECT * FROM identities WHERE provider = 'local' AND subject = 'x'`,
  'a user by email': `SELECT * FROM users WHERE email = 'a@example.com'`,
  'ended executions past retention': `DELETE FROM executions WHERE status <> 'active' AND ended_at < now()`
}

describe('the indexes serve the hot queries', () => {
  it.each(Object.entries(QUERIES))('%s', async (_name, sql) => {
    const plan = await database.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off')
      const rows = await tx.$queryRawUnsafe<Array<{ 'QUERY PLAN': unknown }>>(`EXPLAIN (FORMAT JSON) ${sql}`)
      return JSON.stringify(rows[0]['QUERY PLAN'])
    })

    expect(plan).not.toContain('"Node Type":"Seq Scan"')
    expect(plan).toMatch(/Index/)
  })
})
