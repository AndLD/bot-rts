import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BOT_TYPE, IBot } from '../../../../../lib/utils/interfaces/bots'
import { MapPointResponse } from '../../../map/presentation/map-point.response'
import { ModuleResponse } from '../../../modules/presentation/module.response'

export class BotResponse implements IBot {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiPropertyOptional()
  label?: string

  @ApiPropertyOptional({ format: 'uuid', description: 'Only a base has an owner' })
  userId?: string

  @ApiPropertyOptional({ format: 'uuid', description: 'Any other bot belongs to a base' })
  baseId?: string

  @ApiProperty({ enum: BOT_TYPE })
  type!: BOT_TYPE
}

export class DeployedBaseResponse {
  @ApiProperty({ type: BotResponse })
  bot!: BotResponse

  @ApiProperty({ type: [ModuleResponse] })
  modules!: ModuleResponse[]

  @ApiProperty({ type: MapPointResponse })
  mapPoint!: MapPointResponse
}
