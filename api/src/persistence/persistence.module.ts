import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from '../shared/application/clock'
import { QUERY_STATS, QueryStats } from './application/query-stats'
import { UNIT_OF_WORK } from './application/unit-of-work'
import { WORLD_STATE_STORE } from './application/world-state-store'
import { PRISMA_CLIENT } from './infrastructure/prisma-client'
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work'
import { PrismaWorldStateStore } from './infrastructure/prisma-world-state-store'

// The one place that owns the PrismaClient (task 1.2); features receive repositories built on it
@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [APP_CONFIG, QUERY_STATS],
      useFactory: (config: AppConfig, stats: QueryStats) => {
        // Every query is timed: its duration goes to the stats, its parameters nowhere
        const client = new PrismaClient({ datasourceUrl: config.databaseUrl, log: [{ emit: 'event', level: 'query' }] })
        client.$on('query', (event) => stats.observe(event.duration, event.query))

        return client as unknown as PrismaClient
      }
    },
    {
      provide: QUERY_STATS,
      inject: [APP_CONFIG, CLOCK],
      useFactory: (config: AppConfig, clock: Clock) => new QueryStats(config.monitoring.slowQueryMs, () => clock.now())
    },
    {
      provide: UNIT_OF_WORK,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaUnitOfWork(client)
    },
    {
      provide: WORLD_STATE_STORE,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaWorldStateStore(client)
    }
  ],
  exports: [PRISMA_CLIENT, UNIT_OF_WORK, WORLD_STATE_STORE, QUERY_STATS]
})
export class PersistenceModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  async onApplicationShutdown() {
    await this.client.$disconnect()
  }
}
