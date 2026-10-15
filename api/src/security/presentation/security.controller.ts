import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ISecurityOverview } from '../../../../lib/utils/admin-security'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { SecurityService } from '../application/security.service'
import { SecurityOverviewResponse, SecurityQueryDto } from './dto/security.dto'

export const SECURITY_SERVICE = Symbol('SecurityService')

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The Security page (design §25.3): failed sign-ins, accounts sharing an address, bot lockouts, API keys, scripts the sandbox
// stopped, and the biggest consumers of ops. Banning and quarantine are on the pages of the players.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/security', version: '1' })
export class SecurityController {
  constructor(@Inject(SECURITY_SERVICE) private readonly security: SecurityService) {}

  @RequirePermission('security.read')
  @ApiOkResponse({ type: SecurityOverviewResponse })
  @Get()
  overview(@Query() { hours }: SecurityQueryDto): Promise<ISecurityOverview> {
    return this.security.overview(hours)
  }

  @RequirePermission('security.revoke-key')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'security.revoke-key' })
  @Post('api-keys/:id/revoke')
  async revokeKey(
    @AuditDetailParam() detail: AuditDetail,
    @Param('id', uuid) id: string,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    const { before, after } = await this.security.revokeKey(id)
    Object.assign(detail, { targetType: 'api-key', targetId: id, reason, before, after })
  }
}
