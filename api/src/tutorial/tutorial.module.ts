import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import {
  TUTORIAL_FACTS,
  TUTORIAL_PROGRESS_REPOSITORY,
  TutorialFacts,
  TutorialProgressRepository
} from './application/tutorial.ports'
import { TutorialService } from './application/tutorial.service'
import { PrismaTutorialFacts } from './infrastructure/prisma-tutorial-facts'
import { PrismaTutorialProgressRepository } from './infrastructure/prisma-tutorial-progress.repository'
import { TutorialController } from './presentation/tutorial.controller'

@Module({
  controllers: [TutorialController],
  providers: [
    {
      provide: TUTORIAL_PROGRESS_REPOSITORY,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) =>
        new PrismaTutorialProgressRepository(client, () => clock.now())
    },
    {
      provide: TUTORIAL_FACTS,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaTutorialFacts(client)
    },
    {
      provide: TutorialService,
      inject: [TUTORIAL_PROGRESS_REPOSITORY, TUTORIAL_FACTS],
      useFactory: (progress: TutorialProgressRepository, facts: TutorialFacts) => new TutorialService(progress, facts)
    }
  ]
})
export class TutorialModule {}
