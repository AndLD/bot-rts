import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { defineConfig } from 'cypress'
import { Client } from 'pg'

// Set by `npm run e2e` (scripts/e2e.mjs), which also starts the API and the client
const OUTBOX_DIR = process.env.E2E_OUTBOX_DIR ?? ''
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? ''

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
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    expose: { apiUrl: 'http://localhost:8080' },
    setupNodeEvents(on) {
      on('task', {
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
        async finishFactoryJobs({ email }: { email: string }) {
          await sql(
            `UPDATE modules SET props = jsonb_set(props, '{jobs}', COALESCE(
               (SELECT jsonb_agg(jsonb_set(job, '{readyAt}', '1'::jsonb)) FROM jsonb_array_elements(props->'jobs') job),
               '[]'::jsonb))
             WHERE type = 'factory' AND bot_id = ${BASE_OF_USER}`,
            [email]
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

        async setBaseEnergy({ email, value }: { email: string; value: number }) {
          await sql(
            `UPDATE modules SET props = jsonb_set(props, '{value}', to_jsonb($2::int))
             WHERE type = 'battery' AND bot_id = ${BASE_OF_USER}`,
            [email, value]
          )

          return null
        },

        // The ordinary bots of the player's base: id and label
        async workersOf({ email }: { email: string }) {
          const { rows } = await sql(`SELECT id, label FROM bots WHERE base_id = ${BASE_OF_USER} ORDER BY id`, [email])

          return rows as { id: string; label: string | null }[]
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
