import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IGameTimeAdmin } from '../../../../lib/utils/game-time'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { GameTimeAdminService, GameTimeChange } from '../application/game-time-admin.service'
import { GameTimeAdminResponse, SetDayLengthDto, SetRealWorldDto, SetTimeOfDayDto } from './dto/game-time-admin.dto'

export const GAME_TIME_ADMIN = Symbol('GameTimeAdminService')

// What a change tells the audit trail: the settings before and after, and why
export function recordGameTimeChange(detail: AuditDetail, reason: string, { before, after }: GameTimeChange): void {
  Object.assign(detail, { targetType: 'game-time', targetId: 'gameTime', reason, before, after })
}

// The Game time tab (design §25.3): read for the admins who see the dashboard, change for owners and admins. A change reaches the engine
// and every connected client before the call answers.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/game-time', version: '1' })
export class GameTimeAdminController {
  constructor(@Inject(GAME_TIME_ADMIN) private readonly admin: GameTimeAdminService) {}

  @RequirePermission('dashboard.read')
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Get()
  view(): Promise<IGameTimeAdmin> {
    return this.admin.view()
  }

  @RequirePermission('ops.game-time')
  @HttpCode(200)
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Audited({ action: 'game-time.set-time-of-day' })
  @Post('time-of-day')
  async setTimeOfDay(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { minuteOfDay, reason }: SetTimeOfDayDto
  ): Promise<IGameTimeAdmin> {
    recordGameTimeChange(detail, reason, await this.admin.setTimeOfDay(minuteOfDay))

    return this.admin.view()
  }

  @RequirePermission('ops.game-time')
  @HttpCode(200)
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Audited({ action: 'game-time.set-day-length' })
  @Post('day-length')
  async setDayLength(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { dayLengthMs, reason }: SetDayLengthDto
  ): Promise<IGameTimeAdmin> {
    recordGameTimeChange(detail, reason, await this.admin.setDayLength(dayLengthMs))

    return this.admin.view()
  }

  @RequirePermission('ops.game-time')
  @HttpCode(200)
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Audited({ action: 'game-time.set-real-world' })
  @Post('real-world')
  async setRealWorld(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { timeZone, reason }: SetRealWorldDto
  ): Promise<IGameTimeAdmin> {
    recordGameTimeChange(detail, reason, await this.admin.setRealWorld(timeZone))

    return this.admin.view()
  }

  @RequirePermission('ops.game-time')
  @HttpCode(200)
  @ApiOkResponse({ type: GameTimeAdminResponse })
  @Audited({ action: 'game-time.leave-real-world' })
  @Post('cycle')
  async leaveRealWorld(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { reason }: ReasonDto
  ): Promise<IGameTimeAdmin> {
    recordGameTimeChange(detail, reason, await this.admin.leaveRealWorld())

    return this.admin.view()
  }
}
