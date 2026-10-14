import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { CONTROL_STATE_STORE, ControlStateStore } from '../engine/application/control-state'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { PrismaControlStateStore } from '../engine/infrastructure/prisma-control-state.store'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { USER_REPOSITORY, UserRepository } from '../users/application/user.repository'
import { UsersModule } from '../users/users.module'
import { SUPERVISION_READ_MODEL, SupervisionReadModel } from './application/ports'
import { SupervisionService } from './application/supervision.service'
import { PrismaSupervisionReadModel } from './infrastructure/prisma-supervision-read-model'
import { SUPERVISION_SERVICE, SupervisionController } from './presentation/supervision.controller'

// The Supervision page of the admin console. It asks the engine to change the world and reads the state from the database.
@Module({
  imports: [AdminModule, AuthModule, UsersModule],
  controllers: [SupervisionController],
  providers: [
    {
      provide: CONTROL_STATE_STORE,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaControlStateStore(client, () => clock.now())
    },
    {
      provide: SUPERVISION_READ_MODEL,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaSupervisionReadModel(client)
    },
    {
      provide: SUPERVISION_SERVICE,
      inject: [ENGINE_PORT, CONTROL_STATE_STORE, SUPERVISION_READ_MODEL, USER_REPOSITORY],
      useFactory: (
        engine: EnginePort,
        controls: ControlStateStore,
        readModel: SupervisionReadModel,
        users: UserRepository
      ) => new SupervisionService(engine, controls, readModel, users)
    }
  ]
})
export class SupervisionModule {}
