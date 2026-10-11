import { Prisma } from '@prisma/client'
import { SpawnSeedRepository } from '../application/spawn-seed.repository'
import { SpawnSeed, SpawnSeedMember } from '../domain/spawn-seed'

export class PrismaSpawnSeedRepository implements SpawnSeedRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async find(code: string): Promise<SpawnSeed | null> {
    const row = await this.db.spawnSeed.findUnique({ where: { code } })
    return row && { code: row.code, anchor: { x: row.anchorX, y: row.anchorY, z: 0 }, createdAt: row.createdAt }
  }

  async add({ code, anchor, createdAt }: SpawnSeed): Promise<void> {
    await this.db.spawnSeed.create({ data: { code, anchorX: anchor.x, anchorY: anchor.y, createdAt } })
  }

  async membersOf(code: string): Promise<SpawnSeedMember[]> {
    return await this.db.spawnSeedMember.findMany({ where: { seedCode: code }, orderBy: { userId: 'asc' } })
  }

  async saveMember(member: SpawnSeedMember): Promise<void> {
    await this.db.spawnSeedMember.upsert({
      where: { seedCode_userId: { seedCode: member.seedCode, userId: member.userId } },
      create: member,
      update: { baseId: member.baseId }
    })
  }
}
