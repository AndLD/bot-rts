import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsString, Max, Min } from 'class-validator'
import {
  DEV_TOOLS_MAX_PLAYERS,
  IDevToolsStatus,
  IResetDatabaseResult,
  RESET_CONFIRMATION,
  IRemoveTestPlayersResult,
  ISeedWorldResult,
  ITestPlayer
} from '../../../../../lib/utils/admin-devtools'
import { ReasonDto } from '../../../players/presentation/dto/players.dto'

export class SeedWorldDto extends ReasonDto {
  @IsInt()
  @Min(1)
  @Max(DEV_TOOLS_MAX_PLAYERS)
  @ApiProperty({
    minimum: 1,
    maximum: DEV_TOOLS_MAX_PLAYERS,
    description: 'How many test players to create, each with a base'
  })
  count!: number
}

export class ResetDatabaseDto extends ReasonDto {
  @IsString()
  @ApiProperty({ example: RESET_CONFIRMATION, description: 'The word RESET, typed to confirm' })
  confirmation!: string
}

export class ResetDatabaseResponse implements IResetDatabaseResult {
  @ApiProperty()
  tablesEmptied!: number

  @ApiProperty()
  accountsErased!: number
}

class TestPlayerModel implements ITestPlayer {
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty()
  email!: string

  @ApiProperty()
  password!: string

  @ApiProperty()
  botPassword!: string

  @ApiProperty({ type: String, nullable: true })
  baseId!: string | null
}

export class SeedWorldResponse implements ISeedWorldResult {
  @ApiProperty({ type: [TestPlayerModel] })
  players!: TestPlayerModel[]
}

export class RemoveTestPlayersResponse implements IRemoveTestPlayersResult {
  @ApiProperty()
  removed!: number
}

export class DevToolsStatusResponse implements IDevToolsStatus {
  @ApiProperty()
  isEnabled!: boolean
}
