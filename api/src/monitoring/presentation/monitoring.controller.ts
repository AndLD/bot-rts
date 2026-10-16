import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IAlert, IHealthReport, IMetricSeries } from '../../../../lib/utils/admin'
import { IHealthCheck } from '../../../../lib/utils/admin-health-check'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { HealthView, MONITORING_SERVICE, MonitoringService } from '../application/monitoring.service'
import { composeHealthCheck } from '../application/health-check'
import { toAlertDto } from '../application/alert-dto'
import {
  AlertResponse,
  HealthCheckResponse,
  HealthReportResponse,
  MetricSeriesResponse,
  NodesQueryDto,
  SeriesQueryDto
} from './dto/monitoring.dto'

export const toHealthReport = ({ sampledAt, status, areas, alerts }: HealthView): IHealthReport => ({
  sampledAt: sampledAt?.getTime() ?? null,
  status,
  areas,
  alerts: alerts.map(toAlertDto)
})

// The health and performance numbers of the dashboard (design §25.5)
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/monitoring', version: '1' })
export class MonitoringController {
  constructor(@Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService) {}

  @RequirePermission('dashboard.read', { adminKeyScope: 'admin:health:read' })
  @ApiOkResponse({ type: HealthReportResponse })
  @Get('health')
  health(): IHealthReport {
    return toHealthReport(this.monitoring.health())
  }

  @RequirePermission('dashboard.read', { adminKeyScope: 'admin:metrics:read' })
  @ApiOkResponse({ type: MetricSeriesResponse })
  @Get('series')
  series(@Query() { metric, range, node }: SeriesQueryDto): Promise<IMetricSeries> {
    return this.monitoring.series(metric, range, node)
  }

  @RequirePermission('dashboard.read', { adminKeyScope: 'admin:metrics:read' })
  @ApiOkResponse({ type: [String] })
  @Get('nodes')
  nodes(@Query() { range }: NodesQueryDto): Promise<string[]> {
    return this.monitoring.nodes(range)
  }

  @RequirePermission('dashboard.read', { adminKeyScope: 'admin:health:read' })
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

// One summary of the health, for a look at the state of the system or for an AI assistant (Phase 14)
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/health-check', version: '1' })
export class HealthCheckController {
  constructor(@Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService) {}

  @RequirePermission('dashboard.read', { adminKeyScope: 'admin:health:read' })
  @ApiOkResponse({ type: HealthCheckResponse })
  @Get()
  check(): IHealthCheck {
    return composeHealthCheck(this.monitoring.health())
  }
}
