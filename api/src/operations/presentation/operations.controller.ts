import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import {
  IAnnouncementResult,
  IMaintenanceStatus,
  IOperationsStatus,
  IRestartResult
} from '../../../../lib/utils/admin-operations'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Public } from '../../auth/presentation/public.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { OperationsChange, OperationsService } from '../application/operations.service'
import {
  AnnouncementResultResponse,
  AnnounceDto,
  MaintenanceBannerDto,
  MaintenanceStatusResponse,
  OperationsStatusResponse,
  RestartResultResponse
} from './dto/operations.dto'

export const OPERATIONS_SERVICE = Symbol('OperationsService')

function record(detail: AuditDetail, reason: string, { before, after }: OperationsChange) {
  Object.assign(detail, { targetType: 'operations', reason, before, after })
}

// What anyone may ask before signing in: whether the world is paused, and the banner of a scheduled maintenance
@ApiTags('maintenance')
@ApiDefaultResponse({ type: ErrorResponseModel })
@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(@Inject(OPERATIONS_SERVICE) private readonly operations: OperationsService) {}

  @Public()
  @ApiOkResponse({ type: MaintenanceStatusResponse })
  @Get()
  status(): Promise<IMaintenanceStatus> {
    return this.operations.publicStatus()
  }
}

// The Operations page (design §25.3): the state of what runs, announcements, the maintenance banner, and the restart of the scripts
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/operations', version: '1' })
export class OperationsController {
  constructor(@Inject(OPERATIONS_SERVICE) private readonly operations: OperationsService) {}

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: OperationsStatusResponse })
  @Get()
  status(): Promise<IOperationsStatus> {
    return this.operations.status()
  }

  @RequirePermission('ops.announce')
  @HttpCode(200)
  @ApiOkResponse({ type: AnnouncementResultResponse })
  @Audited({ action: 'operations.announce' })
  @Post('announcements')
  async announce(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { text, reason }: AnnounceDto
  ): Promise<IAnnouncementResult> {
    const { recipients, before, after } = await this.operations.announce(text)
    record(detail, reason, { before, after })

    return { recipients }
  }

  @RequirePermission('ops.announce')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'operations.set-banner' })
  @Put('maintenance-banner')
  async setBanner(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { reason, message, startsAt, endsAt }: MaintenanceBannerDto
  ): Promise<void> {
    record(detail, reason, await this.operations.setBanner({ message, startsAt, endsAt: endsAt ?? null }))
  }

  @RequirePermission('ops.announce')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'operations.clear-banner' })
  @Delete('maintenance-banner')
  async clearBanner(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: ReasonDto): Promise<void> {
    record(detail, reason, await this.operations.clearBanner())
  }

  @RequirePermission('ops.restart-runtime')
  @HttpCode(200)
  @ApiOkResponse({ type: RestartResultResponse })
  @Audited({ action: 'operations.restart-runtime' })
  @Post('restart-runtime')
  async restartRuntime(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { reason }: ReasonDto
  ): Promise<IRestartResult> {
    const { restarted, failedBots, before, after } = await this.operations.restartRuntime()
    record(detail, reason, { before, after })

    return { restarted, failedBots }
  }
}
