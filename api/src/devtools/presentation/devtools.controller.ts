import { Body, Controller, Delete, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IDevToolsStatus, IRemoveTestPlayersResult, ISeedWorldResult } from '../../../../lib/utils/admin-devtools'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { DevToolsChange, DevToolsService } from '../application/devtools.service'
import { DevToolsStatusResponse, RemoveTestPlayersResponse, SeedWorldDto, SeedWorldResponse } from './dto/devtools.dto'

export const DEVTOOLS_SERVICE = Symbol('DevToolsService')

function record(detail: AuditDetail, reason: string, { before, after }: DevToolsChange) {
  Object.assign(detail, { targetType: 'devtools', reason, before, after })
}

// Test-only tools (design §25.3, Dev tools). The routes exist only when `DEV_TOOLS_ENABLED` is set, which production refuses.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/devtools', version: '1' })
export class DevToolsController {
  constructor(@Inject(DEVTOOLS_SERVICE) private readonly devTools: DevToolsService) {}

  // The page asks this first: a server without the tools answers 404
  @RequirePermission('devtools.use')
  @ApiOkResponse({ type: DevToolsStatusResponse })
  @Get()
  status(): IDevToolsStatus {
    return { isEnabled: true }
  }

  @RequirePermission('devtools.use')
  @HttpCode(200)
  @ApiOkResponse({ type: SeedWorldResponse })
  @Audited({ action: 'devtools.seed-world' })
  @Post('seed-world')
  async seedWorld(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { count, reason }: SeedWorldDto
  ): Promise<ISeedWorldResult> {
    const { players, before, after } = await this.devTools.seedWorld(count)
    record(detail, reason, { before, after })

    return { players }
  }

  @RequirePermission('devtools.use')
  @HttpCode(200)
  @ApiOkResponse({ type: RemoveTestPlayersResponse })
  @Audited({ action: 'devtools.remove-test-players' })
  @Delete('test-players')
  async removeTestPlayers(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { reason }: ReasonDto
  ): Promise<IRemoveTestPlayersResult> {
    const { removed, before, after } = await this.devTools.removeTestPlayers()
    record(detail, reason, { before, after })

    return { removed }
  }
}
