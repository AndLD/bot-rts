import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ILogPage, ISlowTick } from '../../../../lib/utils/admin-logs'
import { RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { LogsService } from '../application/logs.service'
import { LogPageResponse, SearchLogsQueryDto, SlowTickResponse } from './dto/logs.dto'

export const LOGS_SERVICE = Symbol('LogsService')

// Logs of this node and slow-tick traces of the engine (design §25.3). Log lines can name players, so they are for `logs.read` only.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/logs', version: '1' })
export class LogsController {
  constructor(@Inject(LOGS_SERVICE) private readonly logs: LogsService) {}

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: LogPageResponse })
  @Get()
  search(@Query() { q, level, requestId, from, to, results }: SearchLogsQueryDto): ILogPage {
    return this.logs.search({ text: q, level, requestId, from, to }, results)
  }

  @RequirePermission('logs.read')
  @ApiOkResponse({ type: SlowTickResponse, isArray: true })
  @Get('slow-ticks')
  slowTicks(): Promise<ISlowTick[]> {
    return this.logs.slowTicks()
  }
}
