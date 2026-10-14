import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ISupervisionState } from '../../../../lib/utils/admin-players'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { Change, SupervisionService } from '../application/supervision.service'
import {
  HaltScriptsDto,
  PauseWorldDto,
  RestoreModuleDto,
  SupervisionStateResponse,
  SupportResourcesDto
} from './dto/supervision.dto'

export const SUPERVISION_SERVICE = Symbol('SupervisionService')

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// What an action tells the audit trail: the target, the reason, and what changed
function record(
  detail: AuditDetail,
  targetType: string,
  targetId: string | undefined,
  reason: string,
  { before, after }: Change
) {
  Object.assign(detail, { targetType, targetId, reason, before, after })
}

// The Supervision page (design §25.3). Every action needs a reason and is audited; the two world-wide switches need a typed word.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/supervision', version: '1' })
export class SupervisionController {
  constructor(@Inject(SUPERVISION_SERVICE) private readonly supervision: SupervisionService) {}

  @RequirePermission('supervision.read')
  @ApiOkResponse({ type: SupervisionStateResponse })
  @Get('state')
  state(): Promise<ISupervisionState> {
    return this.supervision.state()
  }

  @RequirePermission('inspector.kill-execution')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.kill-execution' })
  @Post('executions/:id/kill')
  async kill(@AuditDetailParam() detail: AuditDetail, @Param('id', uuid) id: string, @Body() { reason }: ReasonDto) {
    record(detail, 'execution', id, reason, await this.supervision.killExecution(id))
  }

  @RequirePermission('inspector.reboot-bot')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.reboot-bot' })
  @Post('bots/:id/reboot')
  async reboot(@AuditDetailParam() detail: AuditDetail, @Param('id', uuid) id: string, @Body() { reason }: ReasonDto) {
    record(detail, 'bot', id, reason, await this.supervision.rebootBot(id))
  }

  @RequirePermission('supervision.quarantine')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.quarantine' })
  @Post('players/:id/quarantine')
  async quarantine(
    @CurrentPrincipal() { user }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ) {
    record(detail, 'player', id, reason, await this.supervision.setQuarantine(user, id, true))
  }

  @RequirePermission('supervision.quarantine')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.release' })
  @Post('players/:id/release')
  async release(
    @CurrentPrincipal() { user }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ) {
    record(detail, 'player', id, reason, await this.supervision.setQuarantine(user, id, false))
  }

  @RequirePermission('ops.pause-world')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.pause-world' })
  @Post('world/pause')
  async pause(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: PauseWorldDto) {
    record(detail, 'world', undefined, reason, await this.supervision.setPaused(true))
  }

  @RequirePermission('ops.pause-world')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.resume-world' })
  @Post('world/resume')
  async resume(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: ReasonDto) {
    record(detail, 'world', undefined, reason, await this.supervision.setPaused(false))
  }

  @RequirePermission('ops.kill-switch')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.halt-scripts' })
  @Post('scripts/halt')
  async halt(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: HaltScriptsDto) {
    record(detail, 'scripts', undefined, reason, await this.supervision.setScriptsHalted(true))
  }

  @RequirePermission('ops.kill-switch')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.allow-scripts' })
  @Post('scripts/allow')
  async allow(@AuditDetailParam() detail: AuditDetail, @Body() { reason }: ReasonDto) {
    record(detail, 'scripts', undefined, reason, await this.supervision.setScriptsHalted(false))
  }

  @RequirePermission('supervision.support')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.grant-resources' })
  @Post('support/grant-resources')
  async grant(@AuditDetailParam() detail: AuditDetail, @Body() { botId, stacks, reason }: SupportResourcesDto) {
    record(detail, 'bot', botId, reason, await this.supervision.grantResources(botId, stacks))
  }

  // A compensation is a grant made to make up for a loss; it is its own entry in the trail
  @RequirePermission('supervision.support')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.compensate' })
  @Post('support/compensate')
  async compensate(@AuditDetailParam() detail: AuditDetail, @Body() { botId, stacks, reason }: SupportResourcesDto) {
    record(detail, 'bot', botId, reason, await this.supervision.grantResources(botId, stacks))
  }

  @RequirePermission('supervision.support')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.remove-resources' })
  @Post('support/remove-resources')
  async remove(@AuditDetailParam() detail: AuditDetail, @Body() { botId, stacks, reason }: SupportResourcesDto) {
    record(detail, 'bot', botId, reason, await this.supervision.removeResources(botId, stacks))
  }

  @RequirePermission('supervision.support')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'supervision.restore-module' })
  @Post('support/restore-module')
  async restore(@AuditDetailParam() detail: AuditDetail, @Body() { botId, moduleId, reason }: RestoreModuleDto) {
    record(detail, 'module', moduleId, reason, await this.supervision.restoreModule(botId, moduleId))
  }
}
