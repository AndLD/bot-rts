import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IBotStorage } from '../../../../lib/utils/interfaces/bots'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { JsonValue } from '../../engine/domain/json-value'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { ManualControlService } from '../application/manual-control.service'
import { StorageViewService } from '../application/storage-view.service'
import { BotStorageResponse, ManualActionDto, ManualActionResponse } from './dto/control.dto'
import { toItemDto } from './factory.mapper'
import { categoryOfFunction } from '../../../../lib/utils/interfaces/settings'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const botIdPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

@ApiTags('bots')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'bots/:botId', version: '1' })
export class BotControlController {
  constructor(
    private readonly storage: StorageViewService,
    private readonly control: ManualControlService
  ) {}

  // What the bot carries
  @ApiOkResponse({ type: BotStorageResponse })
  @RequireScope('read')
  @Get('storage')
  async getStorage(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', botIdPipe) botId: string
  ): Promise<IBotStorage> {
    const view = await this.storage.of(user.id, botId)

    return { ...view, items: view.items.map(toItemDto) }
  }

  // A manual action: a call of the script API done by hand, with the same rules and the same answer (design §15.1)
  @HttpCode(200)
  @ApiOkResponse({ type: ManualActionResponse })
  @RequireScope((request) => categoryOfFunction(String(request.body?.fn)) ?? 'read')
  @Post('actions')
  perform(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', botIdPipe) botId: string,
    @Body() body: ManualActionDto
  ): Promise<JsonValue> {
    return this.control.perform(user.id, botId, body.fn, (body.args ?? []) as JsonValue[])
  }
}
