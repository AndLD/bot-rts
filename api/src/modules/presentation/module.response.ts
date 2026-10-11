import { ApiProperty } from '@nestjs/swagger'
import { ModuleType } from '../../../../lib/utils/interfaces/modules'
import { MODULE_TYPES } from '../../../../lib/utils/interfaces/modules'

// The properties every module has; the ones specific to its type (a scanner's `distance`, a drive's `quota`, …) come
// next to them in the same object
export class ModuleResponse {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty({ enum: MODULE_TYPES })
  type!: ModuleType

  @ApiProperty()
  name!: string

  @ApiProperty({ description: 'Hit points left; 0 means broken' })
  condition!: number

  @ApiProperty()
  maxCondition!: number

  @ApiProperty({ description: 'kg' })
  weight!: number

  @ApiProperty()
  operationCost!: number

  @ApiProperty()
  idleCost!: number
}
