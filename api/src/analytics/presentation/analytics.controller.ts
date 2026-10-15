import { Controller, Get, Header, Inject, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IAnalytics } from '../../../../lib/utils/admin-analytics'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { AnalyticsService } from '../application/analytics.service'
import { analyticsCsv } from '../domain/analytics-csv'
import { AnalyticsExportQueryDto, AnalyticsQueryDto, AnalyticsResponse } from './dto/analytics.dto'

export const ANALYTICS_SERVICE = Symbol('AnalyticsService')

const DEFAULT_DAYS = 30

// The Analytics page (design §25.3): active players, retention, the onboarding funnel and achievement rates, and a CSV export of each
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/analytics', version: '1' })
export class AnalyticsController {
  constructor(@Inject(ANALYTICS_SERVICE) private readonly analytics: AnalyticsService) {}

  @RequirePermission('analytics.read')
  @ApiOkResponse({ type: AnalyticsResponse })
  @Get()
  report(@Query() { days }: AnalyticsQueryDto): Promise<IAnalytics> {
    return this.analytics.report(days ?? DEFAULT_DAYS)
  }

  // One report as CSV; exporting is itself audited
  @RequirePermission('analytics.read')
  @ApiOkResponse({ description: 'CSV', schema: { type: 'string' } })
  @Audited({ action: 'analytics.export' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="analytics.csv"')
  @Get('export')
  async export(@Query() { days, report }: AnalyticsExportQueryDto): Promise<string> {
    return analyticsCsv(report, await this.analytics.report(days ?? DEFAULT_DAYS))
  }
}
