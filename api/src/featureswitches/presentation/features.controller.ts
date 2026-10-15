import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IFeatureStatus, IFeatureSwitches } from '../../../../lib/utils/interfaces/features'
import { Audited, RequirePermission } from '../../admin/presentation/admin-permission.decorator'
import { AuditDetail } from '../../admin/presentation/admin-request'
import { AuditDetailParam } from '../../admin/presentation/audit-detail.decorator'
import { Public } from '../../auth/presentation/public.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { FeatureSwitchesService, StoredFeatureSwitches } from '../application/feature-switches.service'
import { FeatureStatusResponse, FeatureSwitchesResponse, UpdateFeatureSwitchesDto } from './dto/features.dto'

const toDto = ({ features, updatedAt }: StoredFeatureSwitches): IFeatureSwitches => ({
  features,
  updatedAt: updatedAt?.getTime() ?? null
})

// Which features of the game are on. Public, so that the sign-up and sign-in screens can explain a switched-off feature too.
@ApiTags('features')
@ApiDefaultResponse({ type: ErrorResponseModel })
@Controller({ path: 'features', version: '1' })
export class FeaturesController {
  constructor(private readonly features: FeatureSwitchesService) {}

  @Public()
  @ApiOkResponse({ type: FeatureStatusResponse })
  @Get()
  async status(): Promise<IFeatureStatus> {
    return { features: (await this.features.get()).features }
  }
}

// The switches of whole features, a tab of the Economy and balance page (design §25.3)
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/features', version: '1' })
export class AdminFeaturesController {
  constructor(private readonly features: FeatureSwitchesService) {}

  @RequirePermission('economy.read')
  @ApiOkResponse({ type: FeatureSwitchesResponse })
  @Get()
  async get(): Promise<IFeatureSwitches> {
    return toDto(await this.features.get())
  }

  @RequirePermission('balance.write')
  @ApiOkResponse({ type: FeatureSwitchesResponse })
  @Audited({ action: 'features.update', targetType: 'features' })
  @Patch()
  async update(
    @AuditDetailParam() detail: AuditDetail,
    @Body() { features, reason }: UpdateFeatureSwitchesDto
  ): Promise<IFeatureSwitches> {
    const { before, after } = await this.features.update(features)

    Object.assign(detail, { targetId: 'features', reason, before, after: after.features })

    return toDto(after)
  }
}
