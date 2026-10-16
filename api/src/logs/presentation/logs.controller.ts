import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ILogNode, ILogPage, ISlowTick } from '../../../../lib/utils/admin-logs'
import { RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { LogsService } from '../application/logs.service'
import { LogNodeResponse, LogPageResponse, SearchLogsQueryDto, SlowTickResponse } from './dto/logs.dto'

export const LOGS_SERVICE = Symbol('LogsService')

// The log of the nodes and slow-tick traces of the engine (design §25.3). Log lines can name players, so they are for `logs.read` only.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/logs', version: '1' })
export class LogsController {
  constructor(@Inject(LOGS_SERVICE) private readonly logs: LogsService) {}

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: LogPageResponse })
  @Get()
  search(@Query() query: SearchLogsQueryDto): Promise<ILogPage> {
    const { q, results, offset, ...filters } = query

    return this.logs.search({ text: q, ...filters }, { limit: results, offset })
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: LogNodeResponse, isArray: true })
  @Get('nodes')
  nodes(): Promise<ILogNode[]> {
    return this.logs.nodes()
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: SlowTickResponse, isArray: true })
  @Get('slow-ticks')
  slowTicks(): Promise<ISlowTick[]> {
    return this.logs.slowTicks()
  }
}
