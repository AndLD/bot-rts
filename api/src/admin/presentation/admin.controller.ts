import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger'
import {
  AdminRole,
  IAdminMe,
  ITwoFactorEnrollment,
  ITwoFactorRecoveryCodes,
  permissionsOf
} from '../../../../lib/utils/admin'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { RateLimit } from '../../ratelimit/presentation/rate-limit.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { SecondFactorService } from '../application/second-factor.service'
import { AdminSecondFactorRoute, Audited } from './admin-permission.decorator'
import {
  AdminMeResponse,
  TwoFactorCodeDto,
  TwoFactorEnrollmentResponse,
  TwoFactorRecoveryCodesResponse
} from './dto/admin.dto'

// Who the admin is and the second factor. These routes are open to any admin role before the factor is verified, because they
// are how it gets verified; the code checks are rate limited like the other auth routes.
@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@AdminSecondFactorRoute()
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly secondFactor: SecondFactorService) {}

  // The guard has already refused anyone who is not an admin, so the status is an admin role
  @ApiOkResponse({ type: AdminMeResponse })
  @Get('me')
  async me(@CurrentPrincipal() { user, identity }: Principal): Promise<IAdminMe> {
    return {
      role: user.status as AdminRole,
      permissions: [...permissionsOf(user.status)],
      twoFactor: await this.secondFactor.status(user.id, identity.sessionId)
    }
  }

  @ApiCreatedResponse({ type: TwoFactorEnrollmentResponse })
  @Audited({ action: 'admin.2fa.begin-enrollment' })
  @Post('2fa/enroll')
  enroll(@CurrentPrincipal() { user }: Principal): Promise<ITwoFactorEnrollment> {
    return this.secondFactor.beginEnrollment(user.id, user.email)
  }

  @RateLimit('auth')
  @HttpCode(200)
  @ApiOkResponse({ type: TwoFactorRecoveryCodesResponse })
  @Audited({ action: 'admin.2fa.confirm-enrollment' })
  @Post('2fa/confirm')
  async confirm(
    @CurrentPrincipal() { user, identity }: Principal,
    @Body() { code }: TwoFactorCodeDto
  ): Promise<ITwoFactorRecoveryCodes> {
    return { recoveryCodes: await this.secondFactor.confirmEnrollment(user.id, identity.sessionId, code) }
  }

  @RateLimit('auth')
  @HttpCode(204)
  @ApiNoContentResponse()
  @Audited({ action: 'admin.2fa.verify' })
  @Post('2fa/verify')
  async verify(@CurrentPrincipal() { user, identity }: Principal, @Body() { code }: TwoFactorCodeDto): Promise<void> {
    await this.secondFactor.verifySession(user.id, identity.sessionId, code)
  }
}
