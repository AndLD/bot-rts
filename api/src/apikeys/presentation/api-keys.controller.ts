import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IApiKey, ICreatedApiKey } from '../../../../lib/utils/interfaces/api-keys'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { ApiKeyService } from '../application/api-key.service'
import { ApiKeyResponse, CreatedApiKeyResponse, CreateApiKeyDto } from './dto/api-keys.dto'
import { toApiKeyDto } from './api-keys.mapper'
import { RequireFeature } from '../../featureswitches/presentation/require-feature.decorator'
import { SessionOnly } from './scope.decorator'

export const API_KEY_SERVICE = Symbol('ApiKeyService')

// The API keys of a player (design §22.1). Keys are managed from a signed-in session only: a key cannot create or revoke keys.
@ApiTags('api-keys')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@SessionOnly()
@Controller({ path: 'api-keys', version: '1' })
export class ApiKeysController {
  constructor(@Inject(API_KEY_SERVICE) private readonly keys: ApiKeyService) {}

  @ApiOkResponse({ type: ApiKeyResponse, isArray: true })
  @Get()
  async list(@CurrentPrincipal() { user }: Principal): Promise<IApiKey[]> {
    return (await this.keys.list(user.id)).map(toApiKeyDto)
  }

  // The response carries the secret; it cannot be read again
  @ApiCreatedResponse({ type: CreatedApiKeyResponse })
  @RequireFeature('apiKeys')
  @Post()
  async create(@CurrentPrincipal() { user }: Principal, @Body() body: CreateApiKeyDto): Promise<ICreatedApiKey> {
    const { key, secret } = await this.keys.create(user.id, body)

    return { ...toApiKeyDto(key), secret }
  }

  @HttpCode(200)
  @ApiOkResponse({ type: ApiKeyResponse })
  @Delete(':id')
  async revoke(@CurrentPrincipal() { user }: Principal, @Param('id') id: string): Promise<IApiKey> {
    return toApiKeyDto(await this.keys.revoke(user.id, id))
  }
}
