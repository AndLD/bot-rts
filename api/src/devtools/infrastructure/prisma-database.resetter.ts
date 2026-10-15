import { PrismaClient } from '@prisma/client'
import { DatabaseResetter, ResetKeep } from '../application/ports'

// The tables the reset never empties: the migrations, the append-only audit log, the settings of the game, and what holds the
// operators' accounts and logins (the accounts that do not stay are removed afterwards, and their rows go with them)
const KEPT_TABLES = [
  '_prisma_migrations',
  'admin_audit_log',
  'game_settings',
  'balance_versions',
  'users',
  'identities',
  'local_credentials',
  'sessions',
  'admin_two_factors',
  'admin_session_verifications',
  'user_settings',
  'api_keys'
]

export class PrismaDatabaseResetter implements DatabaseResetter {
  constructor(private readonly db: PrismaClient) {}

  async wipe({ actorId, sessionId }: ResetKeep): Promise<{ tablesEmptied: number; accountsErased: number }> {
    const tables = (
      await this.db.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`
    )
      .map(({ tablename }) => tablename)
      .filter((name) => !KEPT_TABLES.includes(name))

    return this.db.$transaction(async (tx) => {
      if (tables.length) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((name) => `"${name}"`).join(', ')} CASCADE`)
      }
      // The accounts that stay are every owner and the actor; the rest go, with their logins, keys and settings
      const accountsErased = await tx.$executeRaw`DELETE FROM users WHERE id <> ${actorId}::uuid AND status <> 'owner'`
      // Every other login ends
      await tx.$executeRaw`DELETE FROM sessions WHERE ${sessionId ?? null}::uuid IS NULL OR id <> ${sessionId ?? null}::uuid`
      // The game clock goes back to real time
      await tx.$executeRaw`DELETE FROM game_settings WHERE key = 'gameTime'`

      return { tablesEmptied: tables.length, accountsErased }
    })
  }
}
