import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger'
import { RateLimit, SkipRateLimit } from '../../ratelimit/presentation/rate-limit.decorator'
import { Request, Response } from 'express'
import { IAuthTokenResponse } from '../../../../lib/utils/interfaces/auth'
import { UnauthorizedError } from '../../shared/domain/errors'
import { CREDENTIAL_AUTH, CredentialAuthService, SessionTokens } from '../application/credential-auth.service'
import { Principal } from '../application/auth.service'
import { CurrentPrincipal } from './current-principal.decorator'
import {
  ChangeEmailDto,
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  PasswordDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto
} from './dto/auth.dto'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { AuthTokenResponse } from './dto/auth.response'
import { SessionOnly } from '../../apikeys/presentation/scope.decorator'
import { RequireFeature } from '../../featureswitches/presentation/require-feature.decorator'
import { Public } from './public.decorator'
import { REFRESH_COOKIE, RefreshCookieOptions } from './refresh-cookie'

export const REFRESH_COOKIE_OPTIONS = Symbol('RefreshCookieOptions')

// Every auth route is rate limited per client (RATE_LIMIT_*), except logout
@ApiTags('auth')
@ApiDefaultResponse({ type: ErrorResponseModel })
@RateLimit('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(CREDENTIAL_AUTH) private readonly auth: CredentialAuthService,
    @Inject(REFRESH_COOKIE_OPTIONS) private readonly cookie: RefreshCookieOptions
  ) {}

  @Public()
  @RequireFeature('signUps')
  @ApiCreatedResponse({ type: AuthTokenResponse })
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(
      response,
      await this.auth.register({ ...body, userAgent: request.headers['user-agent'] })
    )
  }

  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: AuthTokenResponse })
  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(
      response,
      await this.auth.login({ ...body, userAgent: request.headers['user-agent'], ip: request.ip })
    )
  }

  @Public()
  @ApiCookieAuth()
  @HttpCode(200)
  @ApiOkResponse({ type: AuthTokenResponse })
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies[REFRESH_COOKIE]

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedError('Unable to refresh the access token')
    }

    return this.respondWithSession(response, await this.auth.refresh(refreshToken))
  }

  @Public()
  @SkipRateLimit()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies[REFRESH_COOKIE]

    if (typeof refreshToken === 'string' && refreshToken) {
      await this.auth.logout(refreshToken)
    }
    response.clearCookie(REFRESH_COOKIE, { path: this.cookie.path, domain: this.cookie.domain })
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('email/verify')
  async verifyEmail(@Body() { token }: TokenDto) {
    await this.auth.verifyEmail(token)
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('email/resend')
  async resendVerification(@Body() { email }: EmailDto) {
    await this.auth.resendVerification(email)
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('password/forgot')
  async forgotPassword(@Body() { email }: EmailDto) {
    await this.auth.requestPasswordReset(email)
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('password/reset')
  async resetPassword(@Body() { token, password }: ResetPasswordDto) {
    await this.auth.resetPassword(token, password)
  }

  @HttpCode(204)
  @ApiNoContentResponse()
  @SessionOnly()
  @Post('password/change')
  async changePassword(@CurrentPrincipal() principal: Principal, @Body() body: ChangePasswordDto) {
    await this.auth.changePassword(
      principal.user.id,
      principal.identity.sessionId,
      body.currentPassword,
      body.newPassword
    )
  }

  @HttpCode(204)
  @ApiNoContentResponse()
  @SessionOnly()
  @Post('email/change')
  async requestEmailChange(@CurrentPrincipal() principal: Principal, @Body() body: ChangeEmailDto) {
    await this.auth.requestEmailChange(principal.user.id, body.password, body.newEmail)
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('email/change/confirm')
  async confirmEmailChange(@Body() { token }: TokenDto) {
    await this.auth.confirmEmailChange(token)
  }

  @HttpCode(204)
  @ApiNoContentResponse()
  @SessionOnly()
  @Post('account/delete')
  async requestAccountDeletion(@CurrentPrincipal() principal: Principal, @Body() { password }: PasswordDto) {
    await this.auth.requestAccountDeletion(principal.user.id, password)
  }

  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  @Post('account/delete/confirm')
  async confirmAccountDeletion(@Body() { token }: TokenDto) {
    await this.auth.confirmAccountDeletion(token)
  }

  private respondWithSession(response: Response, tokens: SessionTokens): IAuthTokenResponse {
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.cookie.secure,
      sameSite: this.cookie.sameSite,
      domain: this.cookie.domain,
      path: this.cookie.path,
      maxAge: this.cookie.maxAgeMs
    })

    return { accessToken: tokens.accessToken }
  }
}
