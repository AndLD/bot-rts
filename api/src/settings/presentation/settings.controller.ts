import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IGameSettings, ISettings } from '../../../../lib/utils/interfaces/settings'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { SettingsService } from '../application/settings.service'
import { GameSettingsResponse, SettingsResponse, UpdateGameSettingsDto, UpdateUserSettingsDto } from './settings.dto'
import { SessionOnly } from '../../apikeys/presentation/scope.decorator'

// The settings of the player, with the game's they are narrowed by
@ApiTags('settings')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOkResponse({ type: SettingsResponse })
  @SessionOnly()
  @Get()
  get(@CurrentPrincipal() { user }: Principal): Promise<ISettings> {
    return this.settings.get(user.id)
  }

  @ApiOkResponse({ type: SettingsResponse })
  @SessionOnly()
  @Patch()
  update(@CurrentPrincipal() { user }: Principal, @Body() body: UpdateUserSettingsDto): Promise<ISettings> {
    return this.settings.updateUser(user.id, body)
  }
}

// The settings of the whole game: what a player can switch on is at most what is on here (design §15.1). They are part of the
// Economy and balance page of the admin console.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/settings', version: '1' })
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOkResponse({ type: GameSettingsResponse })
  @RequirePermission('economy.read')
  @Get()
  get(): Promise<IGameSettings> {
    return this.settings.getGame()
  }

  @ApiOkResponse({ type: GameSettingsResponse })
  @RequirePermission('balance.write')
  @Audited({ action: 'settings.update-categories', targetType: 'settings' })
  @Patch()
  async update(@AuditDetailParam() detail: AuditDetail, @Body() body: UpdateGameSettingsDto): Promise<IGameSettings> {
    const before = await this.settings.getGame()
    const after = await this.settings.updateGame(body.categories)
    Object.assign(detail, { targetId: 'categories', before: before.categories, after: after.categories })

    return after
  }
}
