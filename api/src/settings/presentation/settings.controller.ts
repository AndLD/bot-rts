import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IGameSettings, ISettings } from '../../../../lib/utils/interfaces/settings'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { RequireRole } from '../../auth/presentation/roles.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { SettingsService } from '../application/settings.service'
import { GameSettingsResponse, SettingsResponse, UpdateGameSettingsDto, UpdateUserSettingsDto } from './settings.dto'

// The settings of the player, with the game's they are narrowed by
@ApiTags('settings')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOkResponse({ type: SettingsResponse })
  @Get()
  get(@CurrentPrincipal() { user }: Principal): Promise<ISettings> {
    return this.settings.get(user.id)
  }

  @ApiOkResponse({ type: SettingsResponse })
  @Patch()
  update(@CurrentPrincipal() { user }: Principal, @Body() body: UpdateUserSettingsDto): Promise<ISettings> {
    return this.settings.updateUser(user.id, body)
  }
}

// The settings of the whole game: what a player can switch on is at most what is on here (design §15.1)
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/settings', version: '1' })
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOkResponse({ type: GameSettingsResponse })
  @RequireRole('admin')
  @Get()
  get(): Promise<IGameSettings> {
    return this.settings.getGame()
  }

  @ApiOkResponse({ type: GameSettingsResponse })
  @RequireRole('admin')
  @Patch()
  update(@Body() body: UpdateGameSettingsDto): Promise<IGameSettings> {
    return this.settings.updateGame(body.categories)
  }
}
