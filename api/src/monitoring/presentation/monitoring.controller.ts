import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IAlert, IHealthReport, IMetricSeries } from '../../../../lib/utils/admin'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { MONITORING_SERVICE, MonitoringService } from '../application/monitoring.service'
import { Alert } from '../domain/alert'
import { AlertResponse, HealthReportResponse, MetricSeriesResponse, SeriesQueryDto } from './dto/monitoring.dto'

const toAlertDto = ({ id, openedAt, clearedAt, acknowledgedAt, ...alert }: Alert): IAlert => ({
  _id: id,
  ...alert,
  openedAt: openedAt.getTime(),
  clearedAt: clearedAt?.getTime() ?? null,
  acknowledgedAt: acknowledgedAt?.getTime() ?? null
})

// The health and performance numbers of the dashboard (design §25.5)
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/monitoring', version: '1' })
export class MonitoringController {
  constructor(@Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService) {}

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: HealthReportResponse })
  @Get('health')
  health(): IHealthReport {
    const { sampledAt, status, areas, alerts } = this.monitoring.health()

    return { sampledAt: sampledAt?.getTime() ?? null, status, areas, alerts: alerts.map(toAlertDto) }
  }

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: MetricSeriesResponse })
  @Get('series')
  series(@Query() { metric, range }: SeriesQueryDto): IMetricSeries {
    return this.monitoring.series(metric, range)
  }

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: AlertResponse, isArray: true })
  @Get('alerts')
  alerts(): IAlert[] {
    return this.monitoring.listAlerts().map(toAlertDto)
  }

  @RequirePermission('alerts.acknowledge')
  @Audited({ action: 'alerts.acknowledge', targetType: 'alert', targetParam: 'id' })
  @HttpCode(200)
  @ApiOkResponse({ type: AlertResponse })
  @Post('alerts/:id/acknowledge')
  acknowledge(
    @CurrentPrincipal() { user }: Principal,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })) id: string
  ): IAlert {
    return toAlertDto(this.monitoring.acknowledge(id, user.id))
  }
}
