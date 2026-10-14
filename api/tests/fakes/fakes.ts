import { SettingsRepository } from '../../src/settings/application/settings.repository'
import { CategorySwitches, IUserSettings, withDefaults } from '../../../lib/utils/interfaces/settings'
import { Delay } from '../../src/terminal/application/delay'
import { BotAccessRepository } from '../../src/terminal/application/bot-access.repository'
import { AccessState } from '../../src/terminal/domain/bot-security'
import { BOT_TYPE } from '../../../lib/utils/interfaces/bots'
import { Bot } from '../../src/bots/domain/bot.entity'
import { BotRepository } from '../../src/bots/application/bot.repository'
import { BlueprintRepository } from '../../src/crafting/application/blueprint.repository'
import { Blueprint } from '../../src/crafting/domain/blueprint.entity'
import { ItemRepository } from '../../src/crafting/application/item.repository'
import { Item } from '../../src/crafting/domain/item.entity'
import { File } from '../../src/files/domain/file.entity'
import { FileRepository } from '../../src/files/application/file.repository'
import { MapRepository } from '../../src/map/application/map.repository'
import { KnownPoint, Location, LocationRange, MapPoint } from '../../src/map/domain/map-point.entity'
import { TerminalSessionRepository } from '../../src/terminal/application/terminal-session.repository'
import { TerminalLogEntry, TerminalSession } from '../../src/terminal/domain/terminal-session'
import { TERMINAL_LOG_KIND } from '../../../lib/utils/interfaces/terminal'
import { MapPointType } from '../../../lib/utils/interfaces/map'
import { SpawnSeedRepository } from '../../src/spawn/application/spawn-seed.repository'
import { SpawnSeed, SpawnSeedMember } from '../../src/spawn/domain/spawn-seed'
import { Module } from '../../src/modules/domain/module.entity'
import { ModuleRepository } from '../../src/modules/application/module.repository'
import { Repositories, UnitOfWork } from '../../src/persistence/application/unit-of-work'
import { Clock } from '../../src/shared/application/clock'
import { IdGenerator } from '../../src/shared/application/id-generator'
import { Rng } from '../../src/shared/application/rng'
import {
  AccessTokenClaims,
  AccessTokenService,
  AuthMailer,
  AuthTokenRepository,
  CredentialRepository,
  IdentityRepository,
  PasswordHasher,
  SecretGenerator,
  SessionRepository
} from '../../src/auth/application/ports'
import { AuthToken, AuthTokenKind } from '../../src/auth/domain/auth-token'
import { AccessTokenExpiredError } from '../../src/auth/domain/auth.errors'
import { IdentityLink } from '../../src/auth/domain/identity'
import { LocalCredential } from '../../src/auth/domain/local-credential'
import { Session } from '../../src/auth/domain/session'
import { UnauthorizedError } from '../../src/shared/domain/errors'
import { UserListQuery, UserPage, UserRepository } from '../../src/users/application/user.repository'
import { User } from '../../src/users/domain/user.entity'

// Hand-written fakes of the ports, for unit tests of use cases (no database, no I/O)

export class FakeClock implements Clock {
  constructor(public current = new Date('2026-06-01T12:00:00.000Z')) {}

  now(): Date {
    return this.current
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0

  next(): string {
    this.counter += 1
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`
  }
}

export class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`
  }
}

export class FakeSecretGenerator implements SecretGenerator {
  private counter = 0

  generate(): string {
    this.counter += 1
    return `secret-${this.counter}`
  }

  hash(secret: string): string {
    return `h(${secret})`
  }
}

export class FakeAccessTokenService implements AccessTokenService {
  expired = new Set<string>()

  sign({ userId, sessionId }: AccessTokenClaims): string {
    return `access.${userId}.${sessionId}`
  }

  verify(token: string): AccessTokenClaims {
    const [kind, userId, sessionId] = token.split('.')

    if (this.expired.has(token)) {
      throw new AccessTokenExpiredError()
    }
    if (kind !== 'access' || !userId || !sessionId) {
      throw new UnauthorizedError('The token is invalid')
    }

    return { userId, sessionId }
  }
}

export class RecordingMailer implements AuthMailer {
  readonly sent: { kind: string; to: string; token: string }[] = []
  fail = false

  private record(kind: string, to: string, token: string) {
    if (this.fail) {
      return Promise.reject(new Error('smtp down'))
    }
    this.sent.push({ kind, to, token })
    return Promise.resolve()
  }

  sendEmailVerification(to: string, token: string) {
    return this.record('verification', to, token)
  }

  sendPasswordReset(to: string, token: string) {
    return this.record('password-reset', to, token)
  }

  sendEmailChange(to: string, token: string) {
    return this.record('email-change', to, token)
  }

  sendAccountDeletion(to: string, token: string) {
    return this.record('account-deletion', to, token)
  }

  last(kind: string) {
    return [...this.sent].reverse().find((message) => message.kind === kind)
  }
}

// Returns the given values in order and repeats the last one
export class FixedRng implements Rng {
  private index = 0

  constructor(private readonly values: number[]) {}

  next(): number {
    const value = this.values[Math.min(this.index, this.values.length - 1)]
    this.index += 1
    return value
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>()
  // Users whose email counts as verified in the list (the real adapter joins the credentials)
  readonly verified = new Set<string>()

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async findListItemById(id: string) {
    const user = this.items.get(id)
    return user ? { ...user, isEmailVerified: this.verified.has(id) } : null
  }

  async findByEmail(email: string) {
    return [...this.items.values()].find((user) => user.email === email) ?? null
  }

  async add(user: User) {
    this.items.set(user.id, user)
  }

  async update(user: User) {
    this.items.set(user.id, user)
  }

  async list({ status, isEmailVerified, email, offset, limit }: UserListQuery): Promise<UserPage> {
    const matching = [...this.items.values()]
      .filter((user) => !user.deletedAt)
      .map((user) => ({ ...user, isEmailVerified: this.verified.has(user.id) }))
      .filter(
        (user) =>
          (status === undefined || user.status === status) &&
          (isEmailVerified === undefined || user.isEmailVerified === isEmailVerified) &&
          (email === undefined || user.email === email)
      )
    return { users: matching.slice(offset, offset + limit), total: matching.length }
  }
}

export class InMemoryIdentityRepository implements IdentityRepository {
  readonly items: IdentityLink[] = []

  async findByIdentity(provider: string, subject: string) {
    return this.items.find((link) => link.provider === provider && link.subject === subject) ?? null
  }

  async add(link: IdentityLink) {
    this.items.push(link)
  }

  async deleteByUserId(userId: string) {
    this.items.splice(0, this.items.length, ...this.items.filter((link) => link.userId !== userId))
  }
}

export class InMemoryCredentialRepository implements CredentialRepository {
  readonly items = new Map<string, LocalCredential>()

  async findByUserId(userId: string) {
    return this.items.get(userId) ?? null
  }

  async add(credential: LocalCredential) {
    this.items.set(credential.userId, credential)
  }

  async update(credential: LocalCredential) {
    this.items.set(credential.userId, credential)
  }

  async deleteByUserId(userId: string) {
    this.items.delete(userId)
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly items = new Map<string, Session>()

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async findByRefreshTokenHash(hash: string) {
    return [...this.items.values()].find((session) => session.refreshTokenHash === hash) ?? null
  }

  async add(session: Session) {
    this.items.set(session.id, session)
  }

  async update(session: Session) {
    this.items.set(session.id, session)
  }

  async revokeAllOfUser(userId: string, now: Date, exceptSessionId?: string) {
    for (const session of this.items.values()) {
      if (session.userId === userId && !session.revokedAt && session.id !== exceptSessionId) {
        this.items.set(session.id, { ...session, revokedAt: now })
      }
    }
  }

  async deleteByUserId(userId: string) {
    for (const session of [...this.items.values()]) {
      if (session.userId === userId) {
        this.items.delete(session.id)
      }
    }
  }
}

export class InMemoryAuthTokenRepository implements AuthTokenRepository {
  readonly items = new Map<string, AuthToken>()

  async findByHash(hash: string) {
    return [...this.items.values()].find((token) => token.tokenHash === hash) ?? null
  }

  async add(token: AuthToken) {
    this.items.set(token.id, token)
  }

  async markUsed(id: string, now: Date) {
    const token = this.items.get(id)
    if (token) {
      this.items.set(id, { ...token, usedAt: now })
    }
  }

  async expirePending(userId: string, kind: AuthTokenKind, now: Date) {
    for (const token of this.items.values()) {
      if (token.userId === userId && token.kind === kind && !token.usedAt && token.expiresAt > now) {
        this.items.set(token.id, { ...token, expiresAt: now })
      }
    }
  }

  async deleteByUserId(userId: string) {
    for (const token of [...this.items.values()]) {
      if (token.userId === userId) {
        this.items.delete(token.id)
      }
    }
  }
}

export class InMemoryBotRepository implements BotRepository {
  readonly items = new Map<string, Bot>()

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async add(bot: Bot) {
    this.items.set(bot.id, bot)
  }

  async listOfUser(userId: string, filter?: { type?: BOT_TYPE }) {
    const bases = new Set([...this.items.values()].filter((bot) => bot.userId === userId).map((bot) => bot.id))
    return [...this.items.values()].filter(
      (bot) =>
        (bases.has(bot.id) || (bot.baseId !== null && bases.has(bot.baseId))) &&
        (!filter?.type || bot.type === filter.type)
    )
  }

  async listOfBase(baseId: string) {
    return [...this.items.values()].filter((bot) => bot.baseId === baseId)
  }

  async setLastPosition(botId: string, position: Location) {
    const bot = this.items.get(botId)
    if (bot) {
      this.items.set(botId, { ...bot, lastPosition: position })
    }
  }

  async setPasswordHash(botId: string, passwordHash: string) {
    const bot = this.items.get(botId)
    if (bot) {
      this.items.set(botId, { ...bot, passwordHash })
    }
  }

  async setBase(botId: string, baseId: string) {
    const bot = this.items.get(botId)
    if (bot) {
      this.items.set(botId, { ...bot, baseId })
    }
  }
}

export class InMemoryModuleRepository implements ModuleRepository {
  readonly items: Module[] = []

  async addMany(modules: Module[]) {
    this.items.push(...modules)
  }

  async update(module: Module) {
    const index = this.items.findIndex((candidate) => candidate.id === module.id)
    this.items[index] = module
  }

  async updateMany(modules: readonly Module[]) {
    for (const module of modules) {
      await this.update(module)
    }
  }

  async remove(id: string) {
    const index = this.items.findIndex((candidate) => candidate.id === id)
    if (index >= 0) {
      this.items.splice(index, 1)
    }
  }

  async listOfBot(botId: string) {
    return this.items.filter((module) => module.botId === botId)
  }

  async listOfBots(botIds: readonly string[]) {
    return this.items.filter((module) => botIds.includes(module.botId))
  }

  async listBotIdsWithLiveScanner() {
    const live = this.items.filter((module) => module.type === 'scanner' && module.props.isLive === true)
    return [...new Set(live.map((module) => module.botId))].sort()
  }
}

export class InMemoryFileRepository implements FileRepository {
  readonly items = new Map<string, File>()

  async save(file: File) {
    this.items.set(file.id, file)
  }

  async remove(id: string) {
    this.items.delete(id)
  }

  async findByPath(driveId: string, path: string) {
    return [...this.items.values()].find((file) => file.driveId === driveId && file.path === path) ?? null
  }

  async listOfDrive(driveId: string) {
    return [...this.items.values()]
      .filter((file) => file.driveId === driveId)
      .sort((a, b) => (a.path < b.path ? -1 : 1))
  }

  async usedBytes(driveId: string) {
    return (await this.listOfDrive(driveId)).reduce((sum, file) => sum + file.size, 0)
  }
}

const keyOf = ({ x, y, z }: Location) => `${x}:${y}:${z}`
const within = ({ x, y, z }: Location, { from, to }: LocationRange) =>
  x >= from.x && x <= to.x && y >= from.y && y <= to.y && z >= from.z && z <= to.z

export class InMemoryMapRepository implements MapRepository {
  readonly points = new Map<string, MapPoint>()
  readonly known = new Map<string, KnownPoint>()

  async findPointsInRange(range: LocationRange) {
    return [...this.points.values()].filter((point) => within(point.location, range))
  }

  async findPointByContentId(contentId: string) {
    return [...this.points.values()].find((point) => point.contentId === contentId) ?? null
  }

  async findBasePointsInRange(range: LocationRange) {
    return (await this.findPointsInRange(range)).filter(
      (point) => point.type === MapPointType.BASE || point.type === MapPointType.CORPSE_BASE
    )
  }

  async countBases() {
    return [...this.points.values()].filter(
      (point) => point.type === MapPointType.BASE || point.type === MapPointType.CORPSE_BASE
    ).length
  }

  async addPoints(points: MapPoint[]) {
    for (const point of points) {
      if (!this.points.has(keyOf(point.location))) {
        this.points.set(keyOf(point.location), point)
      }
    }
  }

  async upsertPoint(point: MapPoint) {
    const existing = this.points.get(keyOf(point.location))
    const stored = { ...point, id: existing?.id ?? point.id }
    this.points.set(keyOf(point.location), stored)
    return stored
  }

  async findKnownPointsInRange(userId: string, range: LocationRange) {
    return [...this.known.values()].filter((point) => point.userId === userId && within(point.location, range))
  }

  async upsertKnownPoints(points: KnownPoint[]) {
    for (const point of points) {
      const key = `${point.userId}:${keyOf(point.location)}`
      this.known.set(key, { ...point, id: this.known.get(key)?.id ?? point.id })
    }
  }

  async findKnownPoint(userId: string, location: Location) {
    return this.known.get(`${userId}:${keyOf(location)}`) ?? null
  }
}

export class InMemoryTerminalSessionRepository implements TerminalSessionRepository {
  readonly sessions = new Map<string, TerminalSession>()
  logs: TerminalLogEntry[] = []

  async add(session: TerminalSession) {
    this.sessions.set(session.id, session)
  }

  async findById(id: string) {
    return this.sessions.get(id) ?? null
  }

  async findLatestOfBot(botId: string) {
    const sessions = [...this.sessions.values()].filter((session) => session.botId === botId)
    return sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null
  }

  async close(id: string, endedAt: Date) {
    const session = this.sessions.get(id)
    if (session) {
      this.sessions.set(id, { ...session, endedAt })
    }
  }

  async appendLog(entry: TerminalLogEntry) {
    this.logs.push(entry)
  }

  async appendLogs(entries: readonly TerminalLogEntry[]) {
    this.logs.push(...entries)
  }

  async listLogsOfBot(botId: string, limit: number) {
    return this.logs.filter((entry) => entry.botId === botId).slice(-limit)
  }

  async deleteLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date) {
    this.logs = this.logs.filter((entry) => !kinds.includes(entry.kind) || entry.at >= before)
  }

  async deleteOldestOrdinaryLogs(botId: string, keep: number) {
    const ordinary = this.logs.filter((entry) => entry.botId === botId && entry.kind !== TERMINAL_LOG_KIND.SECURITY)
    const dropped = new Set(ordinary.slice(0, Math.max(0, ordinary.length - keep)))
    this.logs = this.logs.filter((entry) => !dropped.has(entry))
  }
}

export class InMemorySpawnSeedRepository implements SpawnSeedRepository {
  readonly seeds = new Map<string, SpawnSeed>()
  readonly members: SpawnSeedMember[] = []

  async find(code: string) {
    return this.seeds.get(code) ?? null
  }

  async add(seed: SpawnSeed) {
    this.seeds.set(seed.code, seed)
  }

  async membersOf(code: string) {
    return this.members.filter((member) => member.seedCode === code)
  }

  async saveMember(member: SpawnSeedMember) {
    const index = this.members.findIndex((m) => m.seedCode === member.seedCode && m.userId === member.userId)
    if (index === -1) {
      this.members.push(member)
    } else {
      this.members[index] = member
    }
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly repositories: Repositories) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return work(this.repositories)
  }
}

export class InMemoryBlueprintRepository implements BlueprintRepository {
  readonly items: Blueprint[] = []

  async add(blueprint: Blueprint) {
    if (!this.items.some((b) => b.userId === blueprint.userId && b.module === blueprint.module)) {
      this.items.push(blueprint)
    }
  }

  async listOfUser(userId: string) {
    return this.items.filter((blueprint) => blueprint.userId === userId)
  }
}

export class InMemoryItemRepository implements ItemRepository {
  readonly items = new Map<string, Item>()

  async add(item: Item) {
    this.items.set(item.id, item)
  }

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async listByIds(ids: readonly string[]) {
    return ids.flatMap((id) => this.items.get(id) ?? [])
  }

  async listOfBot(botId: string) {
    return [...this.items.values()].filter((item) => item.botId === botId)
  }

  async remove(id: string) {
    this.items.delete(id)
  }
}

export class InMemoryBotAccessRepository implements BotAccessRepository {
  readonly states = new Map<string, AccessState>()

  async find(botId: string) {
    return this.states.get(botId) ?? null
  }

  async save(botId: string, state: AccessState) {
    this.states.set(botId, state)
  }
}

export class FakeDelay implements Delay {
  readonly waits: number[] = []

  async wait(ms: number) {
    this.waits.push(ms)
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  game: CategorySwitches = withDefaults(undefined)
  readonly users = new Map<string, IUserSettings>()

  async getGameCategories() {
    return this.game
  }

  async saveGameCategories(categories: CategorySwitches) {
    this.game = categories
  }

  async getUser(userId: string) {
    return this.users.get(userId) ?? { categories: withDefaults(undefined), reducedMotion: null }
  }

  async saveUser(userId: string, settings: IUserSettings) {
    this.users.set(userId, settings)
  }
}
