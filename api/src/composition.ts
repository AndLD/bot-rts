import { PrismaClient } from '@prisma/client'
import { BotsService } from './bots/application/bots.service'
import { ScanService } from './bots/application/scan.service'
import { MapService } from './map/application/map.service'
import { readWorldConfig } from './map/infrastructure/world-config.reader'
import { SmtpEmailSender } from './notifications/infrastructure/smtp-email-sender'
import { readSmtpConfig } from './notifications/infrastructure/smtp-config'
import { createPrismaRepositories } from './persistence/infrastructure/prisma-repositories'
import { PrismaUnitOfWork } from './persistence/infrastructure/prisma-unit-of-work'
import { SeededRng } from './shared/infrastructure/seeded-rng'
import { SystemClock } from './shared/infrastructure/system-clock'
import { UuidIdGenerator } from './shared/infrastructure/uuid-id-generator'
import { UsersService } from './users/application/users.service'
import { VerificationMailer } from './users/application/verification-mailer'
import { BcryptPasswordHasher } from './users/infrastructure/bcrypt-password-hasher'

type Env = Record<string, string | undefined>

export interface AppServices {
  users: UsersService
  bots: BotsService
  scan: ScanService
  mapService: MapService
  verificationMailer: VerificationMailer
  close(): Promise<void>
}

// The composition root of the legacy Express app: the only place that knows concrete adapters. The NestJS modules of
// task 1.10 replace it.
export function createServices(env: Env, frontendUrl: string): AppServices {
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL })
  const repositories = createPrismaRepositories(prisma)
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const ids = new UuidIdGenerator()
  const clock = new SystemClock()
  const rng = new SeededRng(Number(env.WORLD_SEED) || Date.now())
  const world = readWorldConfig(env)

  const mapService = new MapService(unitOfWork, ids, rng, clock, world)
  const bots = new BotsService(unitOfWork, repositories.bots, repositories.modules, ids, rng, clock, world)
  const smtp = readSmtpConfig(env)
  const sender = smtp ? new SmtpEmailSender(smtp) : undefined

  return {
    users: new UsersService(repositories.users, new BcryptPasswordHasher(), ids, clock),
    bots,
    scan: new ScanService(bots, repositories.modules, repositories.map, mapService),
    mapService,
    verificationMailer: new VerificationMailer(sender, frontendUrl),
    close: async () => {
      sender?.close()
      await prisma.$disconnect()
    }
  }
}
