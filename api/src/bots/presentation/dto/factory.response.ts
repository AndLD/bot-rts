import { ApiProperty } from '@nestjs/swagger'
import { BlueprintSource } from '../../../../../lib/utils/interfaces/crafting'
import { ItemType } from '../../../../../lib/utils/interfaces/items'
import { MapPointResponse } from '../../../map/presentation/map-point.response'
import { ModuleResponse } from '../../../modules/presentation/module.response'
import { BotResponse } from './bots.response'

export class FactoryJobResponse {
  @ApiProperty({ enum: ['craft', 'research'] })
  kind!: 'craft' | 'research'

  @ApiProperty({ example: 'scanner-class1' })
  module!: string

  @ApiProperty({ description: 'When the job is done, in ms' })
  readyAt!: number
}

export class ItemResponse {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ enum: ItemType })
  type!: ItemType

  @ApiProperty({ description: 'For a part or a blueprint: the module it is' })
  name!: string

  @ApiProperty({ description: 'kg' })
  weight!: number
}

export class FactoryStatusResponse {
  @ApiProperty({ description: 'The game clock when the status was taken, in ms' })
  now!: number

  @ApiProperty({ type: [FactoryJobResponse] })
  jobs!: FactoryJobResponse[]

  @ApiProperty({ type: [ItemResponse], description: 'Finished modules, ready to be assembled into a bot' })
  parts!: ItemResponse[]

  @ApiProperty({ type: [ItemResponse], description: 'Blueprints found or looted and not yet learned' })
  blueprintItems!: ItemResponse[]
}

export class BlueprintResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty({ example: 'scanner-class2' })
  module!: string

  @ApiProperty({ enum: BlueprintSource })
  source!: BlueprintSource
}

export class AssembledBotResponse {
  @ApiProperty({ type: BotResponse })
  bot!: BotResponse

  @ApiProperty({ type: [ModuleResponse] })
  modules!: ModuleResponse[]

  @ApiProperty({ type: MapPointResponse })
  mapPoint!: MapPointResponse
}
