import { PrismaClient } from '@prisma/client'
import { HealthCheck } from '../application/health-check'

export class PrismaHealthCheck implements HealthCheck {
  readonly component = 'database'

  constructor(private readonly client: PrismaClient) {}

  async check(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`
  }
}
