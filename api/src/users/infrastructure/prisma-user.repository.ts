import { Prisma, User as UserRow } from '@prisma/client'
import { USER_STATUSES } from '../../../../lib/utils/interfaces/users'
import { UserCountByStatus, UserListQuery, UserPage, UserRepository } from '../application/user.repository'
import { User, UserListItem } from '../domain/user.entity'
import { EmailAlreadyExistsError } from '../domain/user.errors'

function toEntity(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    subscription: row.subscription,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  }
}

function toListItem({ credential, ...row }: UserRow & { credential: { emailVerified: boolean } | null }): UserListItem {
  return { ...toEntity(row), isEmailVerified: credential?.emailVerified ?? false }
}

function isEmailConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } })
    return row && toEntity(row)
  }

  async findListItemById(id: string): Promise<UserListItem | null> {
    const row = await this.db.user.findUnique({
      where: { id },
      include: { credential: { select: { emailVerified: true } } }
    })
    return row && toListItem(row)
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } })
    return row && toEntity(row)
  }

  async add(user: User): Promise<void> {
    await this.db.user.create({ data: user }).catch(this.translateConflict)
  }

  async update(user: User): Promise<void> {
    const { id, ...data } = user
    await this.db.user.update({ where: { id }, data }).catch(this.translateConflict)
  }

  async list({ status, isEmailVerified, email, offset, limit }: UserListQuery): Promise<UserPage> {
    const where: Prisma.UserWhereInput = {
      status,
      email,
      deletedAt: null,
      credential: isEmailVerified === undefined ? undefined : { emailVerified: isEmailVerified }
    }
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: { credential: { select: { emailVerified: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit
      }),
      this.db.user.count({ where })
    ])

    return {
      users: rows.map(toListItem),
      total
    }
  }

  async countByStatus(): Promise<UserCountByStatus> {
    const groups = await this.db.user.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })
    const counts = Object.fromEntries(USER_STATUSES.map((status) => [status, 0])) as UserCountByStatus

    for (const group of groups) {
      counts[group.status] = group._count._all
    }

    return counts
  }

  // A unique-email violation raised by a concurrent registration or email change
  private translateConflict(error: unknown): never {
    throw isEmailConflict(error) ? new EmailAlreadyExistsError() : error
  }
}
