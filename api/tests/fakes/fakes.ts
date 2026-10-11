import { BOT_TYPE } from '../../../lib/utils/interfaces/bots'
import { Bot } from '../../src/bots/domain/bot.entity'
import { BotRepository } from '../../src/bots/application/bot.repository'
import { File } from '../../src/files/domain/file.entity'
import { FileRepository } from '../../src/files/application/file.repository'
import { MapRepository } from '../../src/map/application/map.repository'
import { KnownPoint, Location, LocationRange, MapPoint } from '../../src/map/domain/map-point.entity'
import { Module } from '../../src/modules/domain/module.entity'
import { ModuleRepository } from '../../src/modules/application/module.repository'
import { Repositories, UnitOfWork } from '../../src/persistence/application/unit-of-work'
import { Clock } from '../../src/shared/application/clock'
import { IdGenerator } from '../../src/shared/application/id-generator'
import { Rng } from '../../src/shared/application/rng'
import { PasswordHasher } from '../../src/users/application/password-hasher'
import { UserCountByStatus, UserListQuery, UserPage, UserRepository } from '../../src/users/application/user.repository'
import { User } from '../../src/users/domain/user.entity'
import { USER_STATUSES } from '../../../lib/utils/interfaces/users'

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

  async findById(id: string) {
    return this.items.get(id) ?? null
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

  async list({ status, isActive, email, offset, limit }: UserListQuery): Promise<UserPage> {
    const matching = [...this.items.values()].filter(
      (user) =>
        (status === undefined || user.status === status) &&
        (isActive === undefined || user.isActive === isActive) &&
        (email === undefined || user.email === email)
    )
    return { users: matching.slice(offset, offset + limit), total: matching.length }
  }

  async countByStatus(): Promise<UserCountByStatus> {
    const counts = Object.fromEntries(USER_STATUSES.map((status) => [status, 0])) as UserCountByStatus
    for (const user of this.items.values()) {
      counts[user.status] += 1
    }
    return counts
  }

  async deleteInactiveCreatedBefore(date: Date) {
    let deleted = 0
    for (const user of [...this.items.values()]) {
      if (!user.isActive && user.createdAt < date) {
        this.items.delete(user.id)
        deleted += 1
      }
    }
    return deleted
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
}

export class InMemoryModuleRepository implements ModuleRepository {
  readonly items: Module[] = []

  async addMany(modules: Module[]) {
    this.items.push(...modules)
  }

  async listOfBot(botId: string) {
    return this.items.filter((module) => module.botId === botId)
  }
}

export class InMemoryFileRepository implements FileRepository {
  readonly items: File[] = []

  async add(file: File) {
    this.items.push(file)
  }

  async listOfDrive(driveId: string) {
    return this.items.filter((file) => file.driveId === driveId)
  }

  async findByName(driveId: string, name: string) {
    return this.items.find((file) => file.driveId === driveId && file.name === name) ?? null
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

export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly repositories: Repositories) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return work(this.repositories)
  }
}
