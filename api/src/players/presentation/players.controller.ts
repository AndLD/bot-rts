import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger'
import { IPlayerNote, IPlayerProfile, IPlayersPage } from '../../../../lib/utils/admin-players'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { Clock, CLOCK } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { Actor, Change, PlayersService } from '../application/players.service'
import {
  AddNoteDto,
  BanPlayerDto,
  ChangeRoleDto,
  DeletePlayerDto,
  ListPlayersQueryDto,
  PlayerNoteResponse,
  PlayerProfileResponse,
  PlayersPageResponse,
  ReasonDto
} from './dto/players.dto'
import { toListItem, toNoteDto, toProfileDto } from './players.mapper'

export const PLAYERS_SERVICE = Symbol('PlayersService')

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

const actorOf = ({ user }: Principal): Actor => ({ id: user.id, status: user.status })

// What an action tells the audit trail: the player, the reason, and what changed
function record(detail: AuditDetail, id: string, reason: string, { before, after }: Change): void {
  Object.assign(detail, { targetType: 'player', targetId: id, reason, before, after })
}

// The Players page (design §25.3). Search and the profile are for anyone with `players.read`; each action has its own permission,
// needs a reason, and is refused on an account of the same rank or higher.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/players', version: '1' })
export class PlayersController {
  constructor(
    @Inject(PLAYERS_SERVICE) private readonly players: PlayersService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  @RequirePermission('players.read')
  @ApiOkResponse({ type: PlayersPageResponse })
  @Get()
  async search(@Query() query: ListPlayersQueryDto): Promise<IPlayersPage> {
    const { players, total } = await this.players.search(
      {
        query: query.q,
        status: query.status,
        isEmailVerified: query.isEmailVerified,
        registeredFrom: query.registeredFrom,
        registeredTo: query.registeredTo,
        sort: query.sort,
        isDescending: query.order === 'desc'
      },
      query.page,
      query.results
    )

    return {
      result: players.map(toListItem),
      meta: { pagination: { page: query.page, results: query.results, total } }
    }
  }

  @RequirePermission('players.read')
  @ApiOkResponse({ type: PlayerProfileResponse })
  @Get(':id')
  async profile(@Param('id', uuid) id: string): Promise<IPlayerProfile> {
    return toProfileDto(await this.players.profile(id), this.clock.now())
  }

  @RequirePermission('players.ban')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.ban' })
  @Post(':id/ban')
  async ban(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason, durationHours }: BanPlayerDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.ban(actorOf(principal), id, reason, durationHours))
  }

  @RequirePermission('players.ban')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.unban' })
  @Post(':id/unban')
  async unban(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.unban(actorOf(principal), id))
  }

  @RequirePermission('players.logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.force-logout' })
  @Post(':id/logout')
  async logout(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.forceLogout(actorOf(principal), id))
  }

  @RequirePermission('players.resend-verification')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.resend-verification' })
  @Post(':id/resend-verification')
  async resendVerification(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.resendVerification(actorOf(principal), id))
  }

  @RequirePermission('players.reset-password')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.reset-password' })
  @Post(':id/reset-password')
  async resetPassword(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.triggerPasswordReset(actorOf(principal), id))
  }

  @RequirePermission('players.change-role')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.change-role' })
  @Put(':id/role')
  async changeRole(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { role, reason }: ChangeRoleDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.changeRole(actorOf(principal), id, role))
  }

  @RequirePermission('players.delete')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'players.delete' })
  @Delete(':id')
  async remove(
    @CurrentPrincipal() principal: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason, confirmEmail }: DeletePlayerDto
  ): Promise<void> {
    record(detail, id, reason, await this.players.deleteAccount(actorOf(principal), id, confirmEmail))
  }

  @RequirePermission('players.notes')
  @ApiCreatedResponse({ type: PlayerNoteResponse })
  @Audited({ action: 'players.add-note', targetType: 'player', targetParam: 'id' })
  @Post(':id/notes')
  async addNote(
    @CurrentPrincipal() principal: Principal,
    @Param('id', uuid) id: string,
    @Body() { text }: AddNoteDto
  ): Promise<IPlayerNote> {
    return toNoteDto(await this.players.addNote(actorOf(principal), id, text))
  }
}
