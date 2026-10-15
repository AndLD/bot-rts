import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsOptional } from 'class-validator'
import {
  ANALYTICS_REPORTS,
  ANALYTICS_WINDOWS,
  AnalyticsReport,
  FUNNEL_STEPS,
  FunnelStep,
  IAchievementRate,
  IActivityDay,
  IActivityStats,
  IAnalytics,
  IFunnelStat,
  IRetentionCohort
} from '../../../../../lib/utils/admin-analytics'

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(ANALYTICS_WINDOWS)
  @ApiProperty({ required: false, enum: ANALYTICS_WINDOWS, default: 30, description: 'The window, in days' })
  days?: number
}

export class AnalyticsExportQueryDto extends AnalyticsQueryDto {
  @IsIn(ANALYTICS_REPORTS)
  @ApiProperty({ enum: ANALYTICS_REPORTS })
  report!: AnalyticsReport
}

class ActivityDayModel implements IActivityDay {
  @ApiProperty({ description: 'UTC day, like 2026-10-15' })
  day!: string

  @ApiProperty()
  users!: number
}

class ActivityStatsModel implements IActivityStats {
  @ApiProperty({ type: [ActivityDayModel] })
  daily!: ActivityDayModel[]

  @ApiProperty()
  dau!: number

  @ApiProperty()
  mau!: number
}

class RetentionCohortModel implements IRetentionCohort {
  @ApiProperty({ description: 'The Monday of the week of sign-up' })
  cohort!: string

  @ApiProperty()
  size!: number

  @ApiProperty({ type: Number, nullable: true })
  d1!: number | null

  @ApiProperty({ type: Number, nullable: true })
  d7!: number | null

  @ApiProperty({ type: Number, nullable: true })
  d30!: number | null
}

class FunnelStatModel implements IFunnelStat {
  @ApiProperty({ enum: FUNNEL_STEPS })
  step!: FunnelStep

  @ApiProperty()
  users!: number
}

class AchievementRateModel implements IAchievementRate {
  @ApiProperty()
  id!: string

  @ApiProperty()
  unlocked!: number

  @ApiProperty({ description: 'Of all players, 0 to 1' })
  share!: number
}

export class AnalyticsResponse implements IAnalytics {
  @ApiProperty()
  days!: number

  @ApiProperty()
  players!: number

  @ApiProperty({ type: ActivityStatsModel })
  activity!: ActivityStatsModel

  @ApiProperty({ type: [RetentionCohortModel] })
  retention!: RetentionCohortModel[]

  @ApiProperty({ type: [FunnelStatModel] })
  funnel!: FunnelStatModel[]

  @ApiProperty({ type: [AchievementRateModel] })
  achievements!: AchievementRateModel[]
}
