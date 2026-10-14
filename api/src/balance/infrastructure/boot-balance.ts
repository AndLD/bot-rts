import { PrismaClient } from '@prisma/client'
import { AppConfig } from '../../config/app-config'
import { applyBalance, validateBalance } from '../domain/balance'
import { PrismaBalanceRepository } from './prisma-balance.repository'

// The configuration with the active version of the balance laid over it. Run once at the start of a process, before the modules are
// built, since the world and the crafting read their numbers from the configuration. A stored version that no longer passes
// the checks is not used, and the reason is kept in the configuration for the console to show.
export async function withActiveBalance(config: AppConfig): Promise<AppConfig> {
  const client = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })

  try {
    const repository = new PrismaBalanceRepository(client)
    const version = await repository.activeVersion()
    const record = version === null ? null : await repository.find(version)

    if (!record) {
      return config
    }
    const problems = validateBalance(config.balance.base, record.document)
    if (problems.length) {
      return { ...config, balance: { ...config.balance, problem: `Version ${record.version}: ${problems.join('; ')}` } }
    }
    const merged = applyBalance(config.balance.base, record.document)

    return {
      ...config,
      world: { ...config.world, resources: merged.resources },
      crafting: merged.crafting,
      balance: { ...config.balance, version: record.version }
    }
  } finally {
    await client.$disconnect()
  }
}
