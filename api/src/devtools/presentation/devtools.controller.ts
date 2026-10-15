import { Body, Controller, Delete, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import {
  IDevToolsStatus,
  IRemoveTestPlayersResult,
  IResetDatabaseResult,
  ISeedWorldResult
} from '../../../../lib/utils/admin-devtools'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { IGameTimeAdmin } from '../../../../lib/utils/game-time'
import { GameTimeAdminService } from '../../time/application/game-time-admin.service'
import { GAME_TIME_ADMIN, recordGameTimeChange } from '../../time/presentation/game-time-admin.controller'
import { AdvanceClockDto, GameTimeAdminResponse } from '../../time/presentation/dto/game-time-admin.dto'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { DevToolsChange, DevToolsService } from '../application/devtools.service'
import {
  DevToolsStatusResponse,
  RemoveTestPlayersResponse,
  ResetDatabaseDto,
  ResetDatabaseResponse,
  SeedWorldDto,
  SeedWorldResponse
} from './dto/devtools.dto'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { DatabaseResetService } from '../application/database-reset.service'

export const DEVTOOLS_SERVICE = Symbol('DevToolsService')
export const DATABASE_RESET_SERVICE = Symbol('DatabaseResetService')

function record(detail: AuditDetail, reason: string, { before, after }: DevToolsChange) {
  Object.assign(detail, { targetType: 'devtools', reason, before, after })
}

// Test-only tools (design §25.3, Dev tools). The routes exist only when `DEV_TOOLS_ENABLED` is set, which production refuses.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/devtools', version: '1' })
export class DevToolsController {
  constructor(
    @Inject(DEVTOOLS_SERVICE) private readonly devTools: DevToolsService,
    @Inject(GAME_TIME_ADMIN) private readonly gameTime: GameTimeAdminService,
    @Inject(DATABASE_RESET_SERVICE) private readonly databaseReset: DatabaseResetService
  ) {}

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

  // Moves the game clock forward so that timers finish without waiting; it only goes forward
  @RequirePermission('devtools.use')
  @HttpCode(200)
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Audited({ action: 'devtools.advance-clock' })
  @Post('advance-clock')
  async advanceClock(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { stepMs, reason }: AdvanceClockDto
  ): Promise<IGameTimeAdmin> {
    recordGameTimeChange(detail, reason, await this.gameTime.advance(stepMs))

    return this.gameTime.view()
  }

  // Empties the world of a test server; the owners and the admin who pressed the button stay, every other login ends
  @RequirePermission('devtools.use')
  @HttpCode(200)
  @ApiOkResponse({ type: ResetDatabaseResponse })
  @Audited({ action: 'devtools.reset-database' })
  @Post('reset-database')
  async resetDatabase(
    @CurrentPrincipal() { user, identity }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Body() { confirmation, reason }: ResetDatabaseDto
  ): Promise<IResetDatabaseResult> {
    const result = await this.databaseReset.reset(
      { actorId: user.id, sessionId: identity.sessionId as string },
      confirmation
    )
    record(detail, reason, { before: null, after: result })

    return result
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
