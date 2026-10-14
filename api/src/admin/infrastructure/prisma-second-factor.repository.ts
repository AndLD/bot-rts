import { Prisma } from '@prisma/client'
import { SecondFactorRepository } from '../application/ports'
import { SecondFactor } from '../domain/second-factor'

export class PrismaSecondFactorRepository implements SecondFactorRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async find(userId: string): Promise<SecondFactor | null> {
    const row = await this.db.adminTwoFactor.findUnique({ where: { userId } })

    return row && { ...row, lastUsedStep: row.lastUsedStep === null ? null : Number(row.lastUsedStep) }
  }

  async save(factor: SecondFactor): Promise<void> {
    const data = {
      secretEncrypted: factor.secretEncrypted,
      createdAt: factor.createdAt,
      enabledAt: factor.enabledAt,
      lastUsedStep: factor.lastUsedStep,
      recoveryCodeHashes: [...factor.recoveryCodeHashes]
    }

    await this.db.adminTwoFactor.upsert({
      where: { userId: factor.userId },
      create: { userId: factor.userId, ...data },
      update: data
    })
  }

  async findSessionVerification(sessionId: string): Promise<Date | null> {
    const row = await this.db.adminSessionVerification.findUnique({ where: { sessionId } })

    return row?.verifiedAt ?? null
  }

  async saveSessionVerification(sessionId: string, verifiedAt: Date): Promise<void> {
    await this.db.adminSessionVerification.upsert({
      where: { sessionId },
      create: { sessionId, verifiedAt },
      update: { verifiedAt }
    })
  }
}
