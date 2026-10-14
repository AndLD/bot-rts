import { execFileSync, spawn } from 'child_process'
import { openSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { defineConfig } from 'cypress'
import { Client } from 'pg'

// Set by `npm run e2e` (scripts/e2e.mjs), which also starts the API and the client
const OUTBOX_DIR = process.env.E2E_OUTBOX_DIR ?? ''
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? ''

// How scripts/e2e.mjs started the API, so that a spec can stop it and start it again
interface ApiLaunch {
  command: string
  args: string[]
  cwd: string
  log: string
  env: Record<string, string>
}
const API_LAUNCH: ApiLaunch | null = process.env.E2E_API_LAUNCH ? JSON.parse(process.env.E2E_API_LAUNCH) : null
const API_PORT = Number(process.env.E2E_API_PORT ?? 8080)
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT ?? 5173)

function apiProcesses(): number[] {
  try {
    return execFileSync('lsof', ['-ti', `tcp:${API_PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map(Number)
  } catch {
    // lsof exits with an error when nothing listens
    return []
  }
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))

interface Mail {
  to: string
  subject: string
  html: string
  sentAt: string
}

function readOutbox(): Mail[] {
  return readdirSync(OUTBOX_DIR)
    .sort()
    .map((file) => JSON.parse(readFileSync(join(OUTBOX_DIR, file), 'utf8')) as Mail)
}

// The base of the user whose email is the first parameter of the statement
const BASE_OF_USER = `(SELECT id FROM bots WHERE type = 'base' AND user_id = (SELECT id FROM users WHERE email = $1) LIMIT 1)`

async function sql(text: string, values: unknown[]) {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    return await client.query(text, values)
  } finally {
    await client.end()
  }
}

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${CLIENT_PORT}`,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    expose: { apiUrl: `http://localhost:${API_PORT}` },
    setupNodeEvents(on) {
      on('task', {
        // The API goes down, as when the server crashes or restarts; resolves once nothing listens any more
        async stopApi() {
          apiProcesses().forEach((pid) => process.kill(pid, 'SIGTERM'))
          for (let waited = 0; apiProcesses().length && waited < 20_000; waited += 250) {
            await pause(250)
          }
          apiProcesses().forEach((pid) => process.kill(pid, 'SIGKILL'))

          return null
        },

        // The API is started again as it was; it needs some seconds to listen, which the spec waits for
        startApi() {
          const launch = API_LAUNCH as ApiLaunch
          const log = openSync(launch.log, 'a')
          spawn(launch.command, launch.args, {
            cwd: launch.cwd,
            env: { ...process.env, ...launch.env },
            detached: true,
            stdio: ['ignore', log, log]
          }).unref()

          return null
        },

        // The MCP server of mcp/ plays a few tools over stdio against this game with the given key (scripts/mcp-smoke.mjs)
        mcpSmoke({ apiKey, botId }: { apiKey: string; botId: string }) {
          const output = execFileSync(
            process.execPath,
            [join(process.cwd(), '..', 'scripts', 'mcp-smoke.mjs'), `http://localhost:${API_PORT}`, apiKey, botId],
            { encoding: 'utf8', timeout: 60_000 }
          )

          return JSON.parse(output.trim().split('\n').at(-1) as string) as Record<
            string,
            { isError: boolean; text: string }
          >
        },

        // The links of the newest email to an address with the given subject, or null while none has arrived
        mailLink({ to, subject }: { to: string; subject: string }) {
          const mail = readOutbox()
            .filter((m) => m.to === to && m.subject === subject)
            .at(-1)

          return mail ? (/href="([^"]+)"/.exec(mail.html)?.[1] ?? null) : null
        },

        mailCount({ to }: { to: string }) {
          return readOutbox().filter((m) => m.to === to).length
        },

        async setUserStatus({ email, status }: { email: string; status: string }) {
          await sql('UPDATE users SET status = $1::user_status WHERE email = $2', [status, email])

          return null
        },

        // The wireless adapter of the player's base breaks: the base becomes a corpse for its owner (design §6.3)
        async breakBaseAdapter({ email }: { email: string }) {
          await sql(
            `UPDATE modules SET condition = 0
             WHERE type = 'wirelessAdapter' AND bot_id IN (
               SELECT id FROM bots WHERE type = 'base' AND user_id = (SELECT id FROM users WHERE email = $1))`,
            [email]
          )

          return null
        },

        // Lets a spawn seed look as if it was created a day and an hour ago, which is past its lifetime
        async ageSpawnSeed({ code }: { code: string }) {
          await sql(`UPDATE spawn_seeds SET created_at = now() - interval '25 hours' WHERE code = $1`, [code])

          return null
        },

        // What the terminal stored for the player's base, oldest first, as `kind: text`
        async terminalLines({ email }: { email: string }) {
          const { rows } = await sql(
            `SELECT kind::text AS kind, text FROM terminal_logs
             WHERE bot_id IN (SELECT id FROM bots WHERE user_id = (SELECT id FROM users WHERE email = $1))
             ORDER BY at, id`,
            [email]
          )

          return rows.map((row) => `${row.kind}: ${row.text}`)
        },

        // The base of the player gets room and resources in its storage (design §9.3)
        async stockBase({ email, items }: { email: string; items: { resource: string; amount: number }[] }) {
          await sql(
            `UPDATE modules SET props = props || jsonb_build_object('capacity', 5000, 'items', $2::jsonb)
             WHERE type = 'storage' AND bot_id = ${BASE_OF_USER}`,
            [email, JSON.stringify(items)]
          )

          return null
        },

        // Every job of the factory of the base is done by now
        async finishFactoryJobs({ email, botId }: { email: string; botId?: string }) {
          await sql(
            `UPDATE modules SET props = jsonb_set(props, '{jobs}', COALESCE(
               (SELECT jsonb_agg(jsonb_set(job, '{readyAt}', '1'::jsonb)) FROM jsonb_array_elements(props->'jobs') job),
               '[]'::jsonb))
             WHERE type = 'factory' AND bot_id = ${botId ? '$1::uuid' : BASE_OF_USER}`,
            botId ? [botId] : [email]
          )

          return null
        },

        // A repair module on the base itself, so the base's terminal can repair its neighbours
        async addRepairModule({ email }: { email: string }) {
          await sql(
            `INSERT INTO modules (id, bot_id, type, name, condition, max_condition, weight, operation_cost, idle_cost, props)
             SELECT gen_random_uuid(), ${BASE_OF_USER}, 'repair', 'repair-class1', 100, 100, 25, 5, 0,
                    '{"repairPerOp": 25, "delay": 1000}'::jsonb`,
            [email]
          )

          return null
        },

        // A blueprint item lies in the inventory of the player's base
        async giveBlueprint({ email, module }: { email: string; module: string }) {
          await sql(
            `INSERT INTO items (id, type, name, weight, bot_id)
             SELECT gen_random_uuid(), 'blueprint', $2, 0.1, ${BASE_OF_USER}`,
            [email, module]
          )

          return null
        },

        // The ordinary bots of the player's base: id and label
        async workersOf({ email }: { email: string }) {
          const { rows } = await sql(`SELECT id, label FROM bots WHERE base_id = ${BASE_OF_USER} ORDER BY id`, [email])

          return rows as { id: string; label: string | null }[]
        },

        // A bot is put on a free cell: whatever empty point lay there is replaced by it. The engine reads the world from the
        // database when it next needs it, so this is done between two actions of the player.
        async placeBotAt({ botId, x, y }: { botId: string; x: number; y: number }) {
          await sql(
            `DELETE FROM map_points WHERE x = $2 AND y = $3 AND z = 0 AND content_id IS DISTINCT FROM $1::uuid`,
            [botId, x, y]
          )
          await sql(`UPDATE map_points SET x = $2, y = $3 WHERE content_id = $1::uuid`, [botId, x, y])

          return null
        },

        // Where a bot stands
        async positionOf({ botId }: { botId: string }) {
          const { rows } = await sql(`SELECT x, y FROM map_points WHERE content_id = $1::uuid`, [botId])

          return (rows[0] as { x: number; y: number } | undefined) ?? null
        },

        // An item of the given kind lies on the cell ahead of a bot that faces north (heading 0), where nothing else is
        async placeItemAhead({ botId, type, name }: { botId: string; type: string; name: string }) {
          const { rows } = await sql(`SELECT x, y FROM map_points WHERE content_id = $1::uuid`, [botId])
          const { x, y } = rows[0] as { x: number; y: number }
          await sql(`DELETE FROM map_points WHERE x = $1 AND y = $2 AND z = 0`, [x, y - 1])
          await sql(
            `WITH item AS (
               INSERT INTO items (id, type, name, weight, bot_id) VALUES (gen_random_uuid(), $3::item_type, $4, 1, NULL) RETURNING id)
             INSERT INTO map_points (id, x, y, z, type, content_id) SELECT gen_random_uuid(), $1, $2, 0, 'item', item.id FROM item`,
            [x, y - 1, type, name]
          )

          return { x, y: y - 1 }
        },

        // A deposit of a resource lies on the cell ahead of a bot that faces north (heading 0)
        async placeResourceAhead({ botId, resource, amount }: { botId: string; resource: string; amount: number }) {
          const { rows } = await sql(`SELECT x, y FROM map_points WHERE content_id = $1::uuid`, [botId])
          const { x, y } = rows[0] as { x: number; y: number }
          await sql(`DELETE FROM map_points WHERE x = $1 AND y = $2 AND z = 0`, [x, y - 1])
          await sql(
            `INSERT INTO map_points (id, x, y, z, type, resource, amount)
             VALUES (gen_random_uuid(), $1, $2, 0, 'resource', $3::resource_type, $4)`,
            [x, y - 1, resource, amount]
          )

          return { x, y: y - 1 }
        },

        // The type, name and condition of every module of a bot
        async moduleStates({ botId }: { botId: string }) {
          const { rows } = await sql(`SELECT type, name, condition FROM modules WHERE bot_id = $1::uuid ORDER BY id`, [
            botId
          ])

          return rows as { type: string; name: string; condition: number }[]
        },

        async damageAllModules({ botId, condition }: { botId: string; condition: number }) {
          await sql(`UPDATE modules SET condition = $2 WHERE bot_id = $1::uuid`, [botId, condition])

          return null
        },

        // Properties of the modules of a type are set (merged into what they have)
        async setModuleProps({ botId, type, props }: { botId: string; type: string; props: object }) {
          await sql(`UPDATE modules SET props = props || $3::jsonb WHERE bot_id = $1::uuid AND type = $2`, [
            botId,
            type,
            JSON.stringify(props)
          ])

          return null
        },

        // The properties of the first module of a type of a bot
        async modulePropsOf({ botId, type }: { botId: string; type: string }) {
          const { rows } = await sql(`SELECT props FROM modules WHERE bot_id = $1::uuid AND type = $2 LIMIT 1`, [
            botId,
            type
          ])

          return (rows[0]?.props as Record<string, unknown> | undefined) ?? null
        },

        // What the storage modules of a bot hold, by resource
        async stockOf({ botId }: { botId: string }) {
          const { rows } = await sql(
            `SELECT props->'items' AS items FROM modules WHERE bot_id = $1::uuid AND type = 'storage'`,
            [botId]
          )
          const held: Record<string, number> = {}
          for (const row of rows) {
            for (const { resource, amount } of (row.items ?? []) as { resource: string; amount: number }[]) {
              held[resource] = (held[resource] ?? 0) + amount
            }
          }

          return held
        },

        // The cell of the map where an id stands, and what is there now
        async cellAt({ x, y }: { x: number; y: number }) {
          const { rows } = await sql(
            `SELECT type::text AS type, resource::text AS resource, amount FROM map_points WHERE x = $1 AND y = $2 AND z = 0`,
            [x, y]
          )

          return (
            (rows[0] as { type: string | null; resource: string | null; amount: number | null } | undefined) ?? null
          )
        },

        // The cell is on the map and empty (a cell that is missing is generated again, with whatever the world seed puts there)
        async emptyCell({ x, y }: { x: number; y: number }) {
          await sql(
            `INSERT INTO map_points (id, x, y, z, type, content_id, resource, amount)
             VALUES (gen_random_uuid(), $1, $2, 0, NULL, NULL, NULL, NULL)
             ON CONFLICT (x, y, z) DO UPDATE SET type = NULL, content_id = NULL, resource = NULL, amount = NULL`,
            [x, y]
          )

          return null
        },

        // Whatever lay on a cell is gone
        async removeCell({ x, y }: { x: number; y: number }) {
          await sql(`DELETE FROM map_points WHERE x = $1 AND y = $2 AND z = 0`, [x, y])

          return null
        },

        // The base stops burning its oil: the generator is off and the battery full. The engine writes the storage it remembers
        // whenever the oil changes, which wipes what a test puts there; once the engine has read the base again, this keeps it
        // from writing the storage.
        async quietBase({ botId }: { botId: string }) {
          await sql(
            `UPDATE modules SET props = props || '{"isEnabled": false}'::jsonb WHERE bot_id = $1::uuid AND type = 'generator'`,
            [botId]
          )
          await sql(
            `UPDATE modules SET props = jsonb_set(props, '{value}', props->'capacity') WHERE bot_id = $1::uuid AND type = 'battery'`,
            [botId]
          )

          return null
        },

        async damageModule({ botId, type, condition }: { botId: string; type: string; condition: number }) {
          const { rows } = await sql(
            `UPDATE modules SET condition = $3 WHERE bot_id = $1::uuid AND type = $2 RETURNING id`,
            [botId, type, condition]
          )

          return (rows[0]?.id as string | undefined) ?? null
        },

        // Makes every unused link of a kind sent to the user's address expire an hour ago
        async expireLinks({ email }: { email: string }) {
          await sql(
            `UPDATE auth_tokens SET expires_at = now() - interval '1 hour'
             WHERE user_id = (SELECT id FROM users WHERE email = $1) AND used_at IS NULL`,
            [email]
          )

          return null
        }
      })
    }
  }
})
