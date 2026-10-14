import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { WORLD_CONFIG, WorldConfig } from '../map/domain/world-config'
import { MapModule } from '../map/map.module'
import { MapViewService } from '../mapview/application/map-view.service'
import { MapViewModule } from '../mapview/mapview.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { InspectorService } from './application/inspector.service'
import { INSPECTOR_READ_MODEL, InspectorReadModel } from './application/ports'
import { PrismaInspectorReadModel } from './infrastructure/prisma-inspector-read-model'
import { INSPECTOR_SERVICE, InspectorController } from './presentation/inspector.controller'
import { InspectorTailGateway } from './presentation/inspector-tail.gateway'

// The Inspector and the world map of the admin console, and the live tail of game events
@Module({
  imports: [AdminModule, AuthModule, MapModule, MapViewModule],
  controllers: [InspectorController],
  providers: [
    InspectorTailGateway,
    {
      provide: INSPECTOR_READ_MODEL,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaInspectorReadModel(client)
    },
    {
      provide: INSPECTOR_SERVICE,
      inject: [UNIT_OF_WORK, INSPECTOR_READ_MODEL, MapViewService, WORLD_CONFIG],
      useFactory: (
        unitOfWork: UnitOfWork,
        readModel: InspectorReadModel,
        mapView: MapViewService,
        world: WorldConfig
      ) => new InspectorService(unitOfWork, readModel, mapView, world.resources)
    }
  ]
})
export class InspectorModule {}
