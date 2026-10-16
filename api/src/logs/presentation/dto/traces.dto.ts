import { ApiProperty } from '@nestjs/swagger'
import { Matches } from 'class-validator'
import { ITraceSpan, ITraceView, LOG_STORES, LogStoreName, SpanStatusName } from '../../../../../lib/utils/admin-logs'
import { LogLineModel } from './logs.dto'

export class TraceParamsDto {
  @Matches(/^[\w.-]{1,64}$/)
  @ApiProperty({
    description: 'The trace id of a request, a tick or a job, or the request id of a request from before trace ids'
  })
  id!: string
}

const SPAN_KINDS = ['internal', 'server', 'client', 'producer', 'consumer'] as const
const SPAN_STATUSES = ['unset', 'ok', 'error'] as const

export class TraceSpanModel implements ITraceSpan {
  @ApiProperty()
  spanId!: string

  @ApiProperty({ type: String, nullable: true })
  parentSpanId!: string | null

  @ApiProperty()
  name!: string

  @ApiProperty({ enum: SPAN_KINDS })
  kind!: ITraceSpan['kind']

  @ApiProperty({ type: String, nullable: true, description: 'botrts-api or botrts-engine' })
  service!: string | null

  @ApiProperty({ type: String, nullable: true, description: 'The process that ran it (host and process id)' })
  node!: string | null

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  startedAt!: number

  @ApiProperty()
  durationMs!: number

  @ApiProperty({ enum: SPAN_STATUSES })
  status!: SpanStatusName
}

export class TraceViewResponse implements ITraceView {
  @ApiProperty()
  traceId!: string

  @ApiProperty({
    enum: LOG_STORES,
    description: 'Where the spans are kept; with `memory` there are none, only the lines'
  })
  store!: LogStoreName

  @ApiProperty({ type: [TraceSpanModel] })
  spans!: TraceSpanModel[]

  @ApiProperty({ type: [LogLineModel], description: 'Every line written in the trace by every node, oldest first' })
  logs!: LogLineModel[]

  @ApiProperty({ description: 'True when the trace has more lines than one answer holds' })
  isLogCut!: boolean
}
