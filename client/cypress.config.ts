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
