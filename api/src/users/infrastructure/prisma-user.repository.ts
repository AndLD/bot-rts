import { Prisma, User as UserRow } from '@prisma/client'
import { User } from '../domain/user.entity'
import { UserCountByStatus, UserListQuery, UserPage, UserRepository } from '../application/user.repository'
import { USER_STATUSES } from '../../../../lib/utils/interfaces/users'

function toEntity(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    status: row.status,
    isActive: row.isActive,
    subscription: row.subscription,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

function toRow(user: User): UserRow {
  return { ...user }
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } })
    return row && toEntity(row)
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } })
    return row && toEntity(row)
  }

  async add(user: User): Promise<void> {
    await this.db.user.create({ data: toRow(user) })
  }

  async update(user: User): Promise<void> {
    const { id, ...data } = toRow(user)
    await this.db.user.update({ where: { id }, data })
  }

  async list({ status, isActive, email, offset, limit }: UserListQuery): Promise<UserPage> {
    const where: Prisma.UserWhereInput = { status, isActive, email }
    const [rows, total] = await Promise.all([
      this.db.user.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: offset, take: limit }),
      this.db.user.count({ where })
    ])

    return { users: rows.map(toEntity), total }
  }

  async countByStatus(): Promise<UserCountByStatus> {
    const groups = await this.db.user.groupBy({ by: ['status'], _count: { _all: true } })
    const counts = Object.fromEntries(USER_STATUSES.map((status) => [status, 0])) as UserCountByStatus

    for (const group of groups) {
      counts[group.status] = group._count._all
    }

    return counts
  }

  async deleteInactiveCreatedBefore(date: Date): Promise<number> {
    const result = await this.db.user.deleteMany({ where: { isActive: false, createdAt: { lt: date } } })
    return result.count
  }
}
