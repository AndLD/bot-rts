import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { BOT_REPOSITORY, BotRepository } from '../bots/application/bot.repository'
import { BotsModule } from '../bots/bots.module'
import { ITEM_REPOSITORY, ItemRepository } from '../crafting/application/item.repository'
import { CraftingModule } from '../crafting/crafting.module'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { MAP_REPOSITORY, MapRepository } from '../map/application/map.repository'
import { WORLD_CONFIG, WorldConfig } from '../map/domain/world-config'
import { MapModule } from '../map/map.module'
import { MODULE_REPOSITORY, ModuleRepository } from '../modules/application/module.repository'
import { ModulesModule } from '../modules/modules.module'
import { CLOCK, Clock } from '../shared/application/clock'
import { LiveAreaRegistry } from './application/live-area-registry'
import { LIVE_AREA_SOURCE, MapViewService } from './application/map-view.service'
import { MapController } from './presentation/map.controller'
import { MapGateway } from './presentation/map.gateway'
import { MapStreamer } from './presentation/map-streamer'

// The player's view of the map: reading it, and streaming its changes (design §4.2, §4.4)
@Module({
  imports: [MapModule, BotsModule, ModulesModule, CraftingModule],
  controllers: [MapController],
  providers: [
    MapGateway,
    MapStreamer,
    {
      provide: LiveAreaRegistry,
      inject: [ENGINE_PORT],
      useFactory: (engine: EnginePort) => new LiveAreaRegistry(engine)
    },
    { provide: LIVE_AREA_SOURCE, useExisting: LiveAreaRegistry },
    {
      provide: MapViewService,
      inject: [
        MAP_REPOSITORY,
        BOT_REPOSITORY,
        MODULE_REPOSITORY,
        ITEM_REPOSITORY,
        CLOCK,
        LIVE_AREA_SOURCE,
        WORLD_CONFIG
      ],
      useFactory: (
        maps: MapRepository,
        bots: BotRepository,
        modules: ModuleRepository,
        items: ItemRepository,
        clock: Clock,
        areas: LiveAreaRegistry,
        world: WorldConfig
      ) => new MapViewService(maps, bots, modules, items, clock, areas, world.resources)
    }
  ],
  exports: [MapStreamer]
})
export class MapViewModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(LiveAreaRegistry) private readonly registry: LiveAreaRegistry) {}

  onApplicationBootstrap() {
    this.registry.start()
  }

  onApplicationShutdown() {
    this.registry.stop()
  }
}
