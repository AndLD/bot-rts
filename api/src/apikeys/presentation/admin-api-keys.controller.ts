import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger'
import { IAdminApiKey, ICreatedAdminApiKey } from '../../../../lib/utils/admin-api-keys'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { ApiKeyService } from '../application/api-key.service'
import { toAdminApiKeyDto } from './admin-api-keys.mapper'
import { API_KEY_SERVICE } from './api-keys.controller'
import { AdminApiKeyResponse, CreateAdminApiKeyDto, CreatedAdminApiKeyResponse } from './dto/admin-api-keys.dto'

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The read-only API keys with admin scopes, for an AI assistant (design §25.2). They are granted here, after the second factor, and
// nowhere else; they are not in the player's key list and the player's key endpoint refuses their scopes.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/api-keys', version: '1' })
export class AdminApiKeysController {
  constructor(@Inject(API_KEY_SERVICE) private readonly keys: ApiKeyService) {}

  @RequirePermission('apikeys.admin')
  @ApiOkResponse({ type: AdminApiKeyResponse, isArray: true })
  @Get()
  async list(): Promise<IAdminApiKey[]> {
    return (await this.keys.listAdminKeys()).map(toAdminApiKeyDto)
  }

  // What the key of this very call may do: an MCP client reads it to offer only the tools the key can use
  @RequirePermission('dashboard.read', { adminKeyScope: 'any' })
  @ApiOkResponse({ type: AdminApiKeyResponse })
  @Get('current')
  async current(@CurrentPrincipal() { apiKey }: Principal): Promise<IAdminApiKey> {
    if (!apiKey) {
      throw new NotFoundError('This call was not made with an API key')
    }

    return toAdminApiKeyDto(await this.keys.getAdminKey(apiKey.id))
  }

  // The response carries the secret; it cannot be read again
  @RequirePermission('apikeys.admin')
  @ApiCreatedResponse({ type: CreatedAdminApiKeyResponse })
  @Audited({ action: 'apikeys.admin.create', targetType: 'api-key' })
  @Post()
  async create(
    @AuditDetailParam() detail: AuditDetail,
    @CurrentPrincipal() { user }: Principal,
    @Body() body: CreateAdminApiKeyDto
  ): Promise<ICreatedAdminApiKey> {
    const { key, secret } = await this.keys.createAdminKey(user, body)
    Object.assign(detail, {
      targetId: key.id,
      reason: body.reason,
      after: { scopes: key.scopes, expiresAt: key.expiresAt, ipAllowList: key.adminGrant?.ipAllowList }
    })

    return { ...toAdminApiKeyDto(key), secret }
  }

  @RequirePermission('apikeys.admin')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'apikeys.admin.revoke', targetType: 'api-key', targetParam: 'id' })
  @Post(':id/revoke')
  async revoke(
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    const key = await this.keys.revokeAdminKey(id)
    Object.assign(detail, { reason, before: { scopes: key.scopes }, after: { revoked: true } })
  }
}
