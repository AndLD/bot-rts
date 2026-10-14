import { Prisma } from '@prisma/client'
import { LoginAttemptLog } from '../application/ports'
import { LoginAttempt } from '../domain/login-attempt'

export class PrismaLoginAttemptLog implements LoginAttemptLog {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async record(attempt: LoginAttempt): Promise<void> {
    await this.db.loginAttempt.create({ data: attempt })
  }
}
