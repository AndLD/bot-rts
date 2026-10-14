import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import {
  ILogLine,
  ILogPage,
  ISlowTick,
  LOG_LEVELS,
  LOG_PAGE_MAX,
  LogLevelName
} from '../../../../../lib/utils/admin-logs'

const toDate = ({ value }: { value: unknown }) => new Date(value as string)

export class SearchLogsQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @ApiPropertyOptional({ description: 'A part of the line, such as the id of a player or a bot' })
  q?: string

  @IsOptional()
  @IsIn(LOG_LEVELS)
  @ApiPropertyOptional({ enum: LOG_LEVELS })
  level?: LogLevelName

  @IsOptional()
  @Matches(/^[\w.-]{1,64}$/)
  @ApiPropertyOptional({ description: 'The id of a request (the X-Request-Id of its response)' })
  requestId?: string

  @IsOptional()
  @Transform(toDate)
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  from?: Date

  @IsOptional()
  @Transform(toDate)
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  to?: Date

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LOG_PAGE_MAX)
  @ApiPropertyOptional({ minimum: 1, maximum: LOG_PAGE_MAX, default: 100 })
  results: number = 100
}

class LogLineModel implements ILogLine {
  @ApiProperty({ description: 'Milliseconds since the epoch' })
  at!: number

  @ApiProperty({ enum: LOG_LEVELS })
  level!: LogLevelName

  @ApiProperty()
  message!: string

  @ApiProperty({ type: String, nullable: true })
  requestId!: string | null
}

export class LogPageResponse implements ILogPage {
  @ApiProperty({ type: [LogLineModel] })
  lines!: LogLineModel[]

  @ApiProperty()
  total!: number

  @ApiProperty()
  capacity!: number
}

export class SlowTickResponse implements ISlowTick {
  @ApiProperty()
  tick!: number

  @ApiProperty()
  durationMs!: number

  @ApiProperty()
  intervalMs!: number

  @ApiProperty()
  isCut!: boolean

  @ApiProperty()
  queuedExecutions!: number

  @ApiProperty()
  deferredExecutions!: number
}
