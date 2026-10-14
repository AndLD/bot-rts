import { Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IBalanceDocument, IBalancePreview, IBalanceState, IEconomyOverview } from '../../../../lib/utils/admin-balance'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ReasonDto } from '../../players/presentation/dto/players.dto'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { BalanceChange, BalanceService } from '../application/balance.service'
import { EconomyService } from '../application/economy.service'
import {
  BalanceDocumentDto,
  BalancePreviewResponse,
  BalanceStateResponse,
  BalanceVersionDocumentResponse,
  EconomyOverviewResponse,
  SaveBalanceDto
} from './dto/balance.dto'

export const BALANCE_SERVICE = Symbol('BalanceService')
export const ECONOMY_SERVICE = Symbol('EconomyService')

const versionPipe = new ParseIntPipe({ exceptionFactory: () => new ValidationError('Invalid version') })

function record(detail: AuditDetail, targetId: string, reason: string, { before, after }: BalanceChange) {
  Object.assign(detail, { targetType: 'balance', targetId, reason, before, after })
}

// The Economy and balance page (design §25.3): the state of the economy, and the balance of the game with versions and rollback
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class BalanceController {
  constructor(
    @Inject(BALANCE_SERVICE) private readonly balance: BalanceService,
    @Inject(ECONOMY_SERVICE) private readonly economy: EconomyService
  ) {}

  @RequirePermission('economy.read')
  @ApiOkResponse({ type: EconomyOverviewResponse })
  @Get('economy')
  overview(): Promise<IEconomyOverview> {
    return this.economy.overview()
  }

  @RequirePermission('economy.read')
  @ApiOkResponse({ type: BalanceStateResponse })
  @Get('balance')
  state(): Promise<IBalanceState> {
    return this.balance.state()
  }

  @RequirePermission('economy.read')
  @ApiOkResponse({ type: BalanceVersionDocumentResponse })
  @Get('balance/versions/:version')
  async version(@Param('version', versionPipe) version: number): Promise<{ documentJson: string }> {
    return { documentJson: await this.balance.versionDocument(version) }
  }

  // Checks a document and shows what it would change, without storing anything
  @RequirePermission('balance.write')
  @HttpCode(200)
  @ApiOkResponse({ type: BalancePreviewResponse })
  @Post('balance/preview')
  preview(@Body() { document }: BalanceDocumentDto): Promise<IBalancePreview> {
    return this.balance.preview(document)
  }

  @RequirePermission('balance.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'balance.save' })
  @Post('balance')
  async save(
    @CurrentPrincipal() { user }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Body() { document, reason }: SaveBalanceDto
  ): Promise<void> {
    const change = await this.balance.save(user.id, document as IBalanceDocument, reason)
    record(detail, String((change.after as { version: number }).version), reason, change)
  }

  @RequirePermission('balance.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'balance.rollback' })
  @Post('balance/versions/:version/rollback')
  async rollback(
    @CurrentPrincipal() { user }: Principal,
    @AuditDetailParam() detail: AuditDetail,
    @Param('version', versionPipe) version: number,
    @Body() { reason }: ReasonDto
  ): Promise<void> {
    record(detail, String(version), reason, await this.balance.rollback(user.id, version, reason))
  }
}
