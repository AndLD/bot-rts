import { randomUUID } from 'crypto'
import { BOT_TYPE } from '../../../lib/utils/interfaces/bots'
import { FILE_KIND } from '../../../lib/utils/interfaces/files'
import { Bot } from '../../src/bots/domain/bot.entity'
import { File } from '../../src/files/domain/file.entity'
import { KnownPoint, MapPoint } from '../../src/map/domain/map-point.entity'
import { ItemType } from '../../../lib/utils/interfaces/items'
import { Item } from '../../src/crafting/domain/item.entity'
import { Module } from '../../src/modules/domain/module.entity'
import { User } from '../../src/users/domain/user.entity'
import { AuthToken } from '../../src/auth/domain/auth-token'
import { LocalCredential } from '../../src/auth/domain/local-credential'
import { Session } from '../../src/auth/domain/session'

export function buildUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    name: 'Alice',
    email: `${id}@example.com`,
    status: 'user',
    subscription: 'free',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    deletedAt: null,
    ...overrides
  }
}

export function buildBase(userId: string, overrides: Partial<Bot> = {}): Bot {
  return {
    id: randomUUID(),
    label: 'base',
    type: BOT_TYPE.BASE,
    userId,
    baseId: null,
    passwordHash: 'hash',
    ...overrides
  }
}

export function buildModule(botId: string, overrides: Partial<Module> = {}): Module {
  return {
    id: randomUUID(),
    botId,
    type: 'weapon',
    name: 'gun-class1',
    condition: 100,
    maxCondition: 100,
    weight: 30,
    operationCost: 5,
    idleCost: 0.05,
    props: { damage: 50, cooldown: 2000 },
    ...overrides
  }
}

export function buildFile(driveId: string, overrides: Partial<File> = {}): File {
  const content = overrides.content ?? 'export function main() {}'
  return {
    id: randomUUID(),
    driveId,
    path: 'main.js',
    kind: FILE_KIND.FILE,
    content,
    size: Buffer.byteLength(content, 'utf8'),
    ...overrides
  }
}

export function buildPoint(x: number, y: number, overrides: Partial<MapPoint> = {}): MapPoint {
  return { id: randomUUID(), location: { x, y, z: 0 }, type: null, contentId: null, resource: null, ...overrides }
}

export function buildKnownPoint(userId: string, x: number, y: number, overrides: Partial<KnownPoint> = {}): KnownPoint {
  return { ...buildPoint(x, y), userId, seenAt: 0, ...overrides }
}

export function buildCredential(userId: string, overrides: Partial<LocalCredential> = {}): LocalCredential {
  return {
    userId,
    passwordHash: 'hash',
    emailVerified: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  }
}

export function buildSession(userId: string, overrides: Partial<Session> = {}): Session {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: randomUUID(),
    userId,
    refreshTokenHash: `hash-${randomUUID()}`,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    revokedAt: null,
    userAgent: 'jest',
    ...overrides
  }
}

export function buildAuthToken(userId: string, overrides: Partial<AuthToken> = {}): AuthToken {
  return {
    id: randomUUID(),
    userId,
    kind: 'email_verification',
    tokenHash: `hash-${randomUUID()}`,
    newEmail: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    usedAt: null,
    ...overrides
  }
}

export function buildItem(overrides: Partial<Item> = {}): Item {
  return { id: randomUUID(), type: ItemType.BLUEPRINT, name: 'scanner-class2', weight: 0.1, botId: null, ...overrides }
}
