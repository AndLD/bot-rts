import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsPositive,
  IsUUID,
  Max,
  ValidateNested
} from 'class-validator'
import {
  HALT_CONFIRMATION,
  ISupervisionState,
  IQuarantinedPlayer,
  PAUSE_CONFIRMATION
} from '../../../../../lib/utils/admin-players'
import { RESOURCE, RESOURCES } from '../../../../../lib/utils/interfaces/resources'
import { ReasonDto } from '../../../players/presentation/dto/players.dto'

export const MAX_SUPPORT_AMOUNT = 100_000

export class PauseWorldDto extends ReasonDto {
  @IsIn([PAUSE_CONFIRMATION])
  @ApiProperty({ enum: [PAUSE_CONFIRMATION], description: 'Typed to confirm' })
  confirm!: string
}

export class HaltScriptsDto extends ReasonDto {
  @IsIn([HALT_CONFIRMATION])
  @ApiProperty({ enum: [HALT_CONFIRMATION], description: 'Typed to confirm' })
  confirm!: string
}

export class ResourceStackDto {
  @IsEnum(RESOURCE)
  @ApiProperty({ enum: RESOURCES })
  resource!: RESOURCE

  @IsNumber()
  @IsPositive()
  @Max(MAX_SUPPORT_AMOUNT)
  @ApiProperty({ minimum: 0, exclusiveMinimum: true, maximum: MAX_SUPPORT_AMOUNT })
  amount!: number
}

export class SupportResourcesDto extends ReasonDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'The bot or base whose storage changes' })
  botId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RESOURCES.length)
  @ValidateNested({ each: true })
  @Type(() => ResourceStackDto)
  @ApiProperty({ type: [ResourceStackDto] })
  stacks!: ResourceStackDto[]
}

export class RestoreModuleDto extends ReasonDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid' })
  botId!: string

  @IsUUID()
  @ApiProperty({ format: 'uuid' })
  moduleId!: string
}

class QuarantinedPlayerModel implements IQuarantinedPlayer {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string
}

export class SupervisionStateResponse implements ISupervisionState {
  @ApiProperty()
  isPaused!: boolean

  @ApiProperty()
  areScriptsHalted!: boolean

  @ApiProperty({ type: [QuarantinedPlayerModel] })
  quarantined!: QuarantinedPlayerModel[]

  @ApiProperty()
  activeExecutions!: number

  @ApiProperty()
  heldExecutions!: number
}
