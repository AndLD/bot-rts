import { PrismaClient } from '@prisma/client'
import { HealthProbe } from '../application/health-probe'

export class PrismaHealthProbe implements HealthProbe {
  constructor(private readonly client: PrismaClient) {}

  async pingDatabase(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`
  }
}
