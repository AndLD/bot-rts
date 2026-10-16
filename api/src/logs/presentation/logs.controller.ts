import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ILogNode, ILogPage, ISlowQuery, ISlowTick } from '../../../../lib/utils/admin-logs'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { LogsService } from '../application/logs.service'
import {
  LogNodeResponse,
  LogPageResponse,
  SearchLogsQueryDto,
  SlowQueryResponse,
  SlowTickResponse
} from './dto/logs.dto'

export const LOGS_SERVICE = Symbol('LogsService')

// The log of the nodes and slow-tick traces of the engine (design §25.3). Log lines can name players, so they are for `logs.read` only.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/logs', version: '1' })
export class LogsController {
  constructor(@Inject(LOGS_SERVICE) private readonly logs: LogsService) {}

  // Lines can name players, so every search leaves an audit entry with what was asked (not what was found)
  @RequirePermission('logs.read')
  @Audited({ action: 'logs.search', targetType: 'log' })
  @ApiOkResponse({ type: LogPageResponse })
  @Get()
  search(@AuditDetailParam() detail: AuditDetail, @Query() query: SearchLogsQueryDto): Promise<ILogPage> {
    const { q, results, offset, ...filters } = query
    detail.after = Object.fromEntries(
      Object.entries({ text: q, ...filters, offset }).filter(([, value]) => value !== undefined && value !== 0)
    )

    return this.logs.search({ text: q, ...filters }, { limit: results, offset })
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: LogNodeResponse, isArray: true })
  @Get('nodes')
  nodes(): Promise<ILogNode[]> {
    return this.logs.nodes()
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: SlowQueryResponse, isArray: true })
  @Get('slow-queries')
  slowQueries(): ISlowQuery[] {
    return this.logs.slowQueries()
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: SlowTickResponse, isArray: true })
  @Get('slow-ticks')
  slowTicks(): Promise<ISlowTick[]> {
    return this.logs.slowTicks()
  }
}
