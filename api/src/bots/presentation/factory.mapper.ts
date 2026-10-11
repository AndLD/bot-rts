import { IBlueprint, IFactoryJob, IFactoryStatus } from '../../../../lib/utils/interfaces/crafting'
import { IBotWithModules } from '../../../../lib/utils/interfaces/bots'
import { IItem } from '../../../../lib/utils/interfaces/items'
import { Blueprint } from '../../crafting/domain/blueprint.entity'
import { Item } from '../../crafting/domain/item.entity'
import { toMapPointDto } from '../../map/presentation/map-point.mapper'
import { toModuleDto } from '../../modules/presentation/module.mapper'
import { FactoryJob } from '../../modules/domain/game-module'
import { FactoryStatus } from '../application/factory.service'
import { toBotDto } from './bot.mapper'
import { AssembledBot } from '../application/assembly.service'

export function toItemDto(item: Item): IItem {
  return { _id: item.id, type: item.type, name: item.name, weight: item.weight }
}

export function toJobDto({ kind, module, readyAt }: FactoryJob): IFactoryJob {
  return { kind, module, readyAt }
}

export function toFactoryStatusDto(status: FactoryStatus): IFactoryStatus {
  return {
    now: status.now,
    jobs: status.jobs.map(toJobDto),
    parts: status.parts.map(toItemDto),
    blueprintItems: status.blueprintItems.map(toItemDto)
  }
}

export function toBlueprintDto({ userId, module, source }: Blueprint): IBlueprint {
  return { userId, module, source }
}

export function toAssembledBotDto({ bot, modules, mapPoint }: AssembledBot): IBotWithModules {
  return { bot: toBotDto(bot), modules: modules.map(toModuleDto), mapPoint: toMapPointDto(mapPoint) }
}
