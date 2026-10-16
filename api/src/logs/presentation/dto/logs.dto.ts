import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator'
import {
  ILogLine,
  ILogPage,
  ISlowQuery,
  ISlowTick,
  LOG_LEVELS,
  ILogNode,
  LOG_PAGE_MAX,
  LOG_STORES,
  LogLevelName,
  LogStoreName
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
  @Matches(/^[0-9a-f]{32}$/)
  @ApiPropertyOptional({ description: 'The trace id of a request, a tick or a job (the X-Trace-Id of a response)' })
  traceId?: string

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'The id of a player that the line names' })
  userId?: string

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'The id of a bot that the line names' })
  botId?: string

  @IsOptional()
  @Length(1, 200)
  @IsString()
  @ApiPropertyOptional({ description: 'A process of the node list (host and process id); the default is every node' })
  node?: string

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'How many of the newest matching lines to skip' })
  offset: number = 0
}

export class LogLineModel implements ILogLine {
  @ApiProperty({ description: 'Milliseconds since the epoch' })
  at!: number

  @ApiProperty({ enum: LOG_LEVELS })
  level!: LogLevelName

  @ApiProperty()
  message!: string

  @ApiProperty({ type: String, nullable: true })
  requestId!: string | null

  @ApiProperty({ type: String, nullable: true })
  traceId!: string | null

  @ApiProperty({ type: String, nullable: true, description: 'The process that wrote the line (host and process id)' })
  node!: string | null

  @ApiProperty({ type: String, nullable: true, description: 'botrts-api or botrts-engine' })
  service!: string | null
}

export class LogPageResponse implements ILogPage {
  @ApiProperty({ type: [LogLineModel] })
  lines!: LogLineModel[]

  @ApiProperty()
  total!: number

  @ApiProperty({ type: Number, nullable: true, description: 'How many lines the node keeps; null for the log store' })
  capacity!: number | null

  @ApiProperty({ enum: LOG_STORES })
  store!: LogStoreName
}

export class LogNodeResponse implements ILogNode {
  @ApiProperty()
  id!: string

  @ApiProperty({ type: [String] })
  services!: string[]
}

export class SlowQueryResponse implements ISlowQuery {
  @ApiProperty({ description: 'Milliseconds since the epoch' })
  at!: number

  @ApiProperty()
  durationMs!: number

  @ApiProperty({ description: 'The statement of the query, with its parameters left out' })
  statement!: string
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
