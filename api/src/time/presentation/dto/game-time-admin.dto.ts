import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsString, Length, Max, Min } from 'class-validator'
import {
  DAY_LENGTH_MAX_MS,
  DAY_LENGTH_MIN_MS,
  GAME_TIME_MODES,
  GameTimeMode,
  GameTimeSettings,
  IGameTimeAdmin
} from '../../../../../lib/utils/game-time'
import { ReasonDto } from '../../../players/presentation/dto/players.dto'
import { GameTimeConfigResponse } from '../game-time.response'

export class SetTimeOfDayDto extends ReasonDto {
  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  @ApiProperty({ minimum: 0, maximum: 24 * 60 - 1, description: 'Minutes from 00:00; 990 is 16:30' })
  minuteOfDay!: number
}

export class SetDayLengthDto extends ReasonDto {
  @IsInt()
  @Min(DAY_LENGTH_MIN_MS)
  @Max(DAY_LENGTH_MAX_MS)
  @ApiProperty({
    minimum: DAY_LENGTH_MIN_MS,
    maximum: DAY_LENGTH_MAX_MS,
    description: 'One in-game day in real milliseconds, from 1 minute to 24 hours (the default is 24 minutes)'
  })
  dayLengthMs!: number
}

export class SetRealWorldDto extends ReasonDto {
  @IsString()
  @Length(1, 64)
  @ApiProperty({ example: 'Europe/Kyiv', description: 'An IANA time zone' })
  timeZone!: string
}

export class AdvanceClockDto extends ReasonDto {
  @IsInt()
  @ApiProperty({ description: 'The step in milliseconds: 1 minute, 1 hour or 1 day' })
  stepMs!: number
}

class GameTimeSettingsModel implements GameTimeSettings {
  @ApiProperty()
  dayLengthMs!: number

  @ApiProperty({ enum: GAME_TIME_MODES })
  mode!: GameTimeMode

  @ApiProperty({ type: String, nullable: true })
  timeZone!: string | null

  @ApiProperty()
  anchorMs!: number

  @ApiProperty()
  offsetMs!: number
}

export class GameTimeAdminResponse implements IGameTimeAdmin {
  @ApiProperty({ type: GameTimeSettingsModel })
  settings!: GameTimeSettingsModel

  @ApiProperty({ type: GameTimeConfigResponse })
  config!: GameTimeConfigResponse

  @ApiProperty({ description: 'The game clock instant in milliseconds' })
  now!: number

  @ApiProperty()
  canAdvance!: boolean
}
