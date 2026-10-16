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

export class MetricSeriesResponse implements IMetricSeries {
  @ApiProperty()
  metric!: string

  @ApiProperty()
  stepMs!: number

  @ApiProperty({ type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } })
  points!: Array<[number, number]>
}
