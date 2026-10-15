import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DAY_PHASE, DayPhase, DayPhaseSpan, GameTimeConfig } from '../../../../lib/utils/game-time'
import { GameTimeView } from '../application/game-time.service'

class DayPhaseSpanResponse implements DayPhaseSpan {
  @ApiProperty({ enum: Object.values(DAY_PHASE) })
  phase!: DayPhase

  @ApiProperty({ description: 'In-game hour at which this part of the day starts' })
  fromHour!: number

  @ApiProperty({ description: 'How much sun reaches solar panels, from 0 to 1' })
  sunlight!: number
}

export class GameTimeConfigResponse implements GameTimeConfig {
  @ApiProperty({ description: 'One in-game day in real milliseconds; the world clock counts from the Unix epoch' })
  dayLengthMs!: number

  @ApiProperty()
  hoursPerDay!: number

  @ApiProperty({ type: [DayPhaseSpanResponse] })
  spans!: DayPhaseSpanResponse[]

  @ApiPropertyOptional({ description: 'The game clock instant at which the in-game time is 00:00' })
  anchorMs?: number

  @ApiPropertyOptional({ description: 'The IANA time zone whose wall-clock time the game shows (real-world mode)' })
  timeZone?: string
}

export class GameTimeResponse implements GameTimeView {
  @ApiProperty({ description: 'The server instant in ms' })
  now!: number

  @ApiProperty({ type: GameTimeConfigResponse })
  config!: GameTimeConfigResponse
}
