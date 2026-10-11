import { KnownPoint } from '../../map/domain/map-point.entity'
import { MapService } from '../../map/application/map.service'
import { ScannerModule } from '../../modules/domain/game-module'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { ModuleRepository } from '../../modules/application/module.repository'
import { MapRepository } from '../../map/application/map.repository'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { BotsService } from './bots.service'

export class ScanService {
  constructor(
    private readonly bots: BotsService,
    private readonly modules: ModuleRepository,
    private readonly map: MapRepository,
    private readonly mapService: MapService,
    private readonly registry: ModuleRegistry
  ) {}

  // A bot with a scanner module looks around itself; the cells it sees become the owner's knowledge
  async scan(userId: string, botId: string): Promise<KnownPoint[]> {
    await this.bots.getControlledBot(userId, botId)

    const [scanner] = this.registry.instancesOf(await this.modules.listOfBot(botId), ScannerModule)
    if (!scanner) {
      throw new ValidationError('The bot has no scanner module')
    }

    const position = await this.map.findPointByContentId(botId)
    if (!position) {
      throw new NotFoundError('Bot location not found')
    }

    const { distance } = scanner
    const { x, y, z } = position.location

    return this.mapService.observe(userId, {
      from: { x: x - distance, y: y - distance, z },
      to: { x: x + distance, y: y + distance, z }
    })
  }
}
