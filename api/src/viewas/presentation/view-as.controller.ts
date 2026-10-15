import { Body, Controller, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiDefaultResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { IViewAsStart } from '../../../../lib/utils/admin-players'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { SessionOnly } from '../../apikeys/presentation/scope.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ViewAsService } from '../application/view-as.service'
import { ViewAsStartResponse } from './dto/view-as.dto'
import { AllowInViewAs } from './view-as.decorator'

export const VIEW_AS_SERVICE = Symbol('ViewAsService')

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// "View as player" (design §25.2): the admin starts it from the console and leaves it from the banner of the game screens
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ version: '1' })
export class ViewAsController {
  constructor(@Inject(VIEW_AS_SERVICE) private readonly viewAs: ViewAsService) {}

  @RequirePermission('players.view-as')
  @ApiCreatedResponse({ type: ViewAsStartResponse })
  @Audited({ action: 'players.view-as.start' })
  @Post('admin/players/:id/view-as')
  async start(
    @CurrentPrincipal() { user }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<IViewAsStart> {
    const started = await this.viewAs.start(user, id, reason)

    Object.assign(detail, {
      targetType: 'player',
      targetId: id,
      reason,
      after: { expiresAt: started.expiresAt.toISOString() }
    })

    return {
      accessToken: started.accessToken,
      expiresAt: started.expiresAt.getTime(),
      player: { _id: started.player.id, name: started.player.name }
    }
  }

  // Authenticated like any game route; only a view has anything to leave
  @SessionOnly()
  @AllowInViewAs()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('view-as/exit')
  async exit(@CurrentPrincipal() principal: Principal, @Req() request: Request): Promise<void> {
    if (!principal.viewAs) {
      throw new ForbiddenError('This session is not a view of a player')
    }
    await this.viewAs.end({ ...principal, viewAs: principal.viewAs }, request.ip ?? null)
  }
}
