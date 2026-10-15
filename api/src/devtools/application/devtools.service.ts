import {
  DEV_TOOLS_MAX_PLAYERS,
  IRemoveTestPlayersResult,
  ISeedWorldResult,
  ITestPlayer,
  TEST_EMAIL_DOMAIN
} from '../../../../lib/utils/admin-devtools'
import { PRIVACY_POLICY_VERSION } from '../../../../lib/utils/privacy'
import { eraseAccount } from '../../auth/application/account-erasure'
import { PasswordHasher } from '../../auth/application/ports'
import { LOCAL_PROVIDER } from '../../auth/domain/identity'
import { BotsService } from '../../bots/application/bots.service'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { TestPlayerDirectory } from './ports'

const REMOVE_BATCH = 100

export interface DevToolsChange {
  before: unknown
  after: unknown
}

// Tools for a development or test server (design §25.3, Dev tools): verified test players, each with a base, and their removal. The
// module that holds this is only part of the application where the configuration allows it, never in production.
export class DevToolsService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bots: BotsService,
    private readonly hasher: PasswordHasher,
    private readonly directory: TestPlayerDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly logger: Logger
  ) {}

  async seedWorld(count: number): Promise<ISeedWorldResult & DevToolsChange> {
    if (!Number.isInteger(count) || count < 1 || count > DEV_TOOLS_MAX_PLAYERS) {
      throw new ValidationError(`Create 1 to ${DEV_TOOLS_MAX_PLAYERS} test players at a time`)
    }
    const players: ITestPlayer[] = []

    for (let index = 0; index < count; index += 1) {
      players.push(await this.createTestPlayer())
    }

    return {
      players,
      before: null,
      after: { created: players.map(({ userId, baseId }) => ({ userId, baseId })) }
    }
  }

  // Erases every test player the tools made (the personal data goes, as with a player's own deletion); their bases stay as corpses
  async removeTestPlayers(): Promise<IRemoveTestPlayersResult & DevToolsChange> {
    let removed = 0

    for (;;) {
      const ids = await this.directory.activeIds(REMOVE_BATCH)
      if (!ids.length) {
        break
      }
      await this.unitOfWork.run(async (repositories) => {
        for (const id of ids) {
          const user = await repositories.users.findById(id)
          if (user) {
            await eraseAccount(repositories, user, this.clock.now())
          }
        }
      })
      removed += ids.length
    }

    return { removed, before: null, after: { removed } }
  }

  private async createTestPlayer(): Promise<ITestPlayer> {
    const id = this.ids.next()
    const suffix = id.slice(0, 8)
    const email = `player-${suffix}@${TEST_EMAIL_DOMAIN}`
    const password = `Dev-${suffix}-1`
    const botPassword = `bot-${suffix}`
    const name = `Test ${suffix}`
    const passwordHash = await this.hasher.hash(password)
    const now = this.clock.now()

    await this.unitOfWork.run(async ({ users, identities, credentials }) => {
      await users.add({
        id,
        name,
        email,
        status: 'user',
        subscription: 'free',
        privacyAcceptedVersion: PRIVACY_POLICY_VERSION,
        privacyAcceptedAt: now,
        createdAt: now,
        updatedAt: null,
        deletedAt: null
      })
      await identities.add({
        id: this.ids.next(),
        provider: LOCAL_PROVIDER,
        subject: id,
        userId: id,
        createdAt: now
      })
      await credentials.add({ userId: id, passwordHash, emailVerified: true, updatedAt: now })
    })

    return { userId: id, email, password, botPassword, baseId: await this.deployBase(id, name, botPassword) }
  }

  private async deployBase(userId: string, name: string, botPassword: string): Promise<string | null> {
    try {
      return (await this.bots.deployUserBase({ id: userId, name }, { password: botPassword })).bot.id
    } catch (error) {
      this.logger.warn(`Dev tools: no base for test player ${userId}: ${(error as Error).message}`)

      return null
    }
  }
}
