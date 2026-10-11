import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { USER_REPOSITORY, UserRepository } from './application/user.repository'
import { UsersService } from './application/users.service'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository'
import { StatisticsController } from './presentation/statistics.controller'
import { UsersController } from './presentation/users.controller'

@Module({
  controllers: [UsersController, StatisticsController],
  providers: [
    {
      provide: USER_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaUserRepository(client)
    },
    {
      provide: UsersService,
      inject: [USER_REPOSITORY, CLOCK],
      useFactory: (users: UserRepository, clock: Clock) => new UsersService(users, clock)
    }
  ],
  exports: [USER_REPOSITORY, UsersService]
})
export class UsersModule {}
