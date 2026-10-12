import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches } from 'class-validator'
import { IBotStorage } from '../../../../../lib/utils/interfaces/bots'
import { IItem, ItemType } from '../../../../../lib/utils/interfaces/items'
import { IResourceStack, RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { SCRIPT_MAX_LIST_LENGTH } from '../../../../../lib/utils/script-api'

export class ManualActionDto {
  // A function of the script API (design §10.2)
  @IsString()
  @Matches(/^[a-zA-Z]{1,32}$/)
  @ApiProperty({ example: 'drop' })
  fn!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SCRIPT_MAX_LIST_LENGTH)
  @ApiPropertyOptional({ description: 'The arguments of the call, as a script would pass them', type: [Object] })
  args?: unknown[]
}

// The answer a script would get from the call
export class ManualActionResponse {
  @ApiProperty()
  ok!: boolean

  @ApiPropertyOptional({ description: 'What the call returned' })
  data?: unknown

  @ApiPropertyOptional({ description: 'Why the call failed, for example BLOCKED or OUT_OF_RANGE' })
  code?: string

  @ApiPropertyOptional()
  msg?: string
}

class ResourceStackModel implements IResourceStack {
  @ApiProperty({ enum: RESOURCE })
  resource!: RESOURCE

  @ApiProperty()
  amount!: number
}

class ItemModel implements IItem {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ enum: ItemType })
  type!: ItemType

  @ApiProperty()
  name!: string

  @ApiProperty({ description: 'kg' })
  weight!: number
}

export class BotStorageResponse implements IBotStorage {
  @ApiProperty()
  capacity!: number

  @ApiProperty()
  used!: number

  @ApiProperty({ type: [ResourceStackModel] })
  resources!: ResourceStackModel[]

  @ApiProperty({ type: [ItemModel] })
  items!: ItemModel[]

  @ApiProperty()
  carriedWeight!: number

  @ApiProperty()
  loadCapacity!: number
}
