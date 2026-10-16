import { IHealthCheck } from '../../../../../lib/utils/admin-health-check'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, Length } from 'class-validator'
import {
  HEALTH_STATUSES,
  HealthStatus,
  IAlert,
  IAreaHealth,
  IHealthReport,
  IMetricHealth,
  IMetricSeries,
  ISlowestSample,
  METRIC_RANGES,
  MetricRange,
  MONITOR_AREAS,
  MonitorArea
} from '../../../../../lib/utils/admin'

export class SeriesQueryDto {
  @IsString()
  @ApiProperty({ example: 'engine.tickP95Ms' })
  metric!: string

  @IsIn(METRIC_RANGES)
  @ApiProperty({ enum: METRIC_RANGES })
  range!: MetricRange

  @IsOptional()
  @IsString()
  @Length(1, 200)
  @ApiPropertyOptional({
    description: 'One node (host and process id, from the nodes list); the default is every node'
  })
  node?: string
}

export class NodesQueryDto {
  @IsIn(METRIC_RANGES)
  @ApiProperty({ enum: METRIC_RANGES })
  range!: MetricRange
}

export class AlertResponse implements IAlert {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  metric!: string

  @ApiProperty({ enum: MONITOR_AREAS })
  area!: MonitorArea

  @ApiProperty({ enum: ['yellow', 'red'] })
  severity!: 'yellow' | 'red'

  @ApiProperty()
  value!: number

  @ApiProperty()
  threshold!: number

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  openedAt!: number

  @ApiProperty({ type: Number, nullable: true })
  clearedAt!: number | null

  @ApiProperty({ type: Number, nullable: true })
  acknowledgedAt!: number | null

  @ApiProperty({ type: String, nullable: true })
  acknowledgedBy!: string | null
}

class MetricHealthModel implements IMetricHealth {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: MONITOR_AREAS })
  area!: MonitorArea

  @ApiProperty()
  unit!: string

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null

  @ApiProperty({ enum: HEALTH_STATUSES })
  status!: HealthStatus
}

class AreaHealthModel implements IAreaHealth {
  @ApiProperty({ enum: MONITOR_AREAS })
  area!: MonitorArea

  @ApiProperty({ enum: HEALTH_STATUSES })
  status!: HealthStatus

  @ApiProperty({ type: [MetricHealthModel] })
  metrics!: MetricHealthModel[]
}

export class HealthReportResponse implements IHealthReport {
  @ApiProperty({ type: Number, nullable: true, description: 'Milliseconds since the epoch' })
  sampledAt!: number | null

  @ApiProperty({ enum: HEALTH_STATUSES })
  status!: HealthStatus

  @ApiProperty({ type: [AreaHealthModel] })
  areas!: AreaHealthModel[]

  @ApiProperty({ type: [AlertResponse] })
  alerts!: AlertResponse[]
}

export class SlowestSampleResponse implements ISlowestSample {
  @ApiProperty({ description: 'Start of the step, in milliseconds since the epoch' })
  at!: number

  @ApiProperty()
  durationMs!: number

  @ApiProperty({ description: 'The trace of the slowest observation of the step' })
  traceId!: string
}

export class MetricSeriesResponse implements IMetricSeries {
  @ApiProperty()
  metric!: string

  @ApiProperty()
  stepMs!: number

  @ApiProperty({ type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } })
  points!: Array<[number, number]>

  @ApiPropertyOptional({
    type: [SlowestSampleResponse],
    description: 'For the percentiles of a distribution: the slowest sample of each step'
  })
  slowest?: SlowestSampleResponse[]
}

const nullableNumber = (description?: string) => ApiProperty({ type: Number, nullable: true, description })

class TickHealthModel {
  @nullableNumber() p95Ms!: number | null
  @nullableNumber('The 95th percentile tick as a share of the tick interval') p95Ratio!: number | null
  @nullableNumber('Ticks over the interval, as a share of the ticks since the previous sample') overrunRate!:
    number | null
  @nullableNumber() cutTicks!: number | null
  @nullableNumber() skippedTicks!: number | null
}

class ScriptsHealthModel {
  @nullableNumber('Scripts stopped for using more than the slice of a tick') killedBySlice!: number | null
}

class FlushHealthModel {
  @nullableNumber() lastMs!: number | null
  @nullableNumber() lagMs!: number | null
  @nullableNumber() pending!: number | null
}

class StoreHealthModel {
  @ApiProperty({ enum: HEALTH_STATUSES }) databaseStatus!: HealthStatus
  @ApiProperty({ type: Boolean, nullable: true, description: 'Null when no gateway is configured' })
  isLogGatewayUp!: boolean | null
}

export class HealthCheckResponse implements IHealthCheck {
  @nullableNumber('Milliseconds since the epoch') sampledAt!: number | null
  @ApiProperty({ enum: HEALTH_STATUSES }) status!: HealthStatus
  @ApiProperty({ type: [AlertResponse], description: 'The alerts that are open now' }) alerts!: AlertResponse[]
  @ApiProperty({ type: TickHealthModel }) tick!: TickHealthModel
  @ApiProperty({ type: ScriptsHealthModel }) scripts!: ScriptsHealthModel
  @ApiProperty({ type: FlushHealthModel }) flush!: FlushHealthModel
  @ApiProperty({ type: StoreHealthModel }) store!: StoreHealthModel
}
