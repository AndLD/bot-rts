import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { RNG, Rng } from '../shared/application/rng'
import { MAP_REPOSITORY } from './application/map.repository'
import { MapService } from './application/map.service'
import { PrismaMapRepository } from './infrastructure/prisma-map.repository'
import { WORLD_CONFIG } from './domain/world-config'

@Module({
  providers: [
    {
      provide: MAP_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaMapRepository(client)
    },
    { provide: WORLD_CONFIG, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.world },
    {
      provide: MapService,
      inject: [UNIT_OF_WORK, ID_GENERATOR, RNG, CLOCK, WORLD_CONFIG],
      useFactory: (unitOfWork: UnitOfWork, ids: IdGenerator, rng: Rng, clock: Clock, world: AppConfig['world']) =>
        new MapService(unitOfWork, ids, rng, clock, world)
    }
  ],
  exports: [MAP_REPOSITORY, WORLD_CONFIG, MapService]
})
export class MapModule {}
