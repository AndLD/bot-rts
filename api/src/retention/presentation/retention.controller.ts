import { Body, Controller, Get, HttpCode, Inject, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IRetention, RETENTION_JOBS, RetentionJob, RetentionSettings } from '../../../../lib/utils/admin-retention'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { LIFECYCLE_JOB } from '../../lifecycle/application/lifecycle.service'
import { JOB_STATUS_STORE, JobStatusStore } from '../../operations/application/ports'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { RetentionSettingsService } from '../application/retention-settings.service'
import { ReasonOnlyDto, RetentionResponse, UpdateRetentionDto } from './dto/retention.dto'

// What each job removed in a pass, as the lifecycle job reports it; the jobs that report nothing are null
const REPORT_KEYS: Readonly<Record<RetentionJob, readonly string[] | null>> = {
  lifecycle: null,
  terminalLogs: ['terminalLogsDeleted', 'terminalSessionsDeleted'],
  executions: ['executionsDeleted'],
  notifications: ['notificationsDeleted'],
  authData: ['authRowsDeleted'],
  unverifiedAccounts: ['unverifiedAccountsDeleted'],
  inactiveAccounts: ['inactiveAccountsErased'],
  playerActivity: ['playerActivityDeleted'],
  monitoring: ['monitoringHistoryDeleted']
}

// The retention settings of the Operations page (design §25.3): every retention job with its switch, its ranges and its last pass
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/retention', version: '1' })
export class RetentionController {
  constructor(
    private readonly retention: RetentionSettingsService,
    @Inject(JOB_STATUS_STORE) private readonly jobs: JobStatusStore
  ) {}

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: RetentionResponse })
  @Get()
  get(): Promise<IRetention> {
    return this.view()
  }

  @RequirePermission('ops.retention')
  @ApiOkResponse({ type: RetentionResponse })
  @Audited({ action: 'retention.update', targetType: 'retention' })
  @Patch()
  async update(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { jobs, confirmation, reason }: UpdateRetentionDto
  ): Promise<IRetention> {
    const { before, after } = await this.retention.update(jobs, confirmation)

    Object.assign(detail, { targetId: 'retention', reason, before, after })

    return this.view()
  }

  @RequirePermission('ops.retention')
  @HttpCode(200)
  @ApiOkResponse({ type: RetentionResponse })
  @Audited({ action: 'retention.reset', targetType: 'retention' })
  @Post('reset')
  async reset(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: ReasonOnlyDto): Promise<IRetention> {
    const { before, after } = await this.retention.reset()

    Object.assign(detail, { targetId: 'retention', reason, before, after })

    return this.view()
  }

  private async view(): Promise<IRetention> {
    const [{ settings, updatedAt }, statuses] = await Promise.all([this.retention.load(), this.jobs.list()])
    const status = statuses.find(({ name }) => name === LIFECYCLE_JOB)
    const defaults: RetentionSettings = this.retention.getDefaults()

    return {
      jobs: RETENTION_JOBS.map((job) => {
        const keys = REPORT_KEYS[job]

        return {
          job,
          values: settings[job],
          defaults: defaults[job],
          isOverridden: JSON.stringify(settings[job]) !== JSON.stringify(defaults[job]),
          lastRemoved:
            keys && status?.lastPass ? keys.reduce((sum, key) => sum + (status.lastPass?.[key] ?? 0), 0) : null
        }
      }),
      lastRunAt: status?.lastRunAt ?? null,
      hasFailures: Boolean(status?.lastPass?.failedSteps),
      updatedAt: updatedAt?.getTime() ?? null
    }
  }
}
