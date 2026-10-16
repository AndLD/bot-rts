import { Controller, Get, Inject, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ITraceView } from '../../../../lib/utils/admin-logs'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { TracesService } from '../application/traces.service'
import { TraceParamsDto, TraceViewResponse } from './dto/traces.dto'

export const TRACES_SERVICE = Symbol('TracesService')

// One request followed over the nodes: its spans and its log lines (design §25.3). The lines can name players, so it is for
// `logs.read` only, like the log, and every read leaves an audit entry with the trace id.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/traces', version: '1' })
export class TracesController {
  constructor(@Inject(TRACES_SERVICE) private readonly traces: TracesService) {}

  @RequirePermission('logs.read')
  @Audited({ action: 'logs.read-trace', targetType: 'trace' })
  @ApiOkResponse({ type: TraceViewResponse })
  @Get(':id')
  read(@AuditDetailParam() detail: AuditDetail, @Param() { id }: TraceParamsDto): Promise<ITraceView> {
    detail.targetId = id

    return this.traces.read(id)
  }
}
