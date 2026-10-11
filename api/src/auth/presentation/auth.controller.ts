import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
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
import { Public } from './public.decorator'
import { REFRESH_COOKIE, RefreshCookieOptions } from './refresh-cookie'

export const REFRESH_COOKIE_OPTIONS = Symbol('RefreshCookieOptions')

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(CREDENTIAL_AUTH) private readonly auth: CredentialAuthService,
    @Inject(REFRESH_COOKIE_OPTIONS) private readonly cookie: RefreshCookieOptions
  ) {}

  @Public()
  @Throttle({ default: {} })
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(
      response,
      await this.auth.register({ ...body, userAgent: request.headers['user-agent'] })
    )
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(200)
  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(
      response,
      await this.auth.login({ ...body, userAgent: request.headers['user-agent'] })
    )
  }

  @Public()
  @Throttle({ default: {} })
  @ApiCookieAuth()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies[REFRESH_COOKIE]

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedError('Unable to refresh the access token')
    }

    return this.respondWithSession(response, await this.auth.refresh(refreshToken))
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies[REFRESH_COOKIE]

    if (typeof refreshToken === 'string' && refreshToken) {
      await this.auth.logout(refreshToken)
    }
    response.clearCookie(REFRESH_COOKIE, { path: this.cookie.path })
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('email/verify')
  async verifyEmail(@Body() { token }: TokenDto) {
    await this.auth.verifyEmail(token)
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('email/resend')
  async resendVerification(@Body() { email }: EmailDto) {
    await this.auth.resendVerification(email)
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('password/forgot')
  async forgotPassword(@Body() { email }: EmailDto) {
    await this.auth.requestPasswordReset(email)
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('password/reset')
  async resetPassword(@Body() { token, password }: ResetPasswordDto) {
    await this.auth.resetPassword(token, password)
  }

  @HttpCode(204)
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
  @Post('email/change')
  async requestEmailChange(@CurrentPrincipal() principal: Principal, @Body() body: ChangeEmailDto) {
    await this.auth.requestEmailChange(principal.user.id, body.password, body.newEmail)
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('email/change/confirm')
  async confirmEmailChange(@Body() { token }: TokenDto) {
    await this.auth.confirmEmailChange(token)
  }

  @HttpCode(204)
  @Post('account/delete')
  async requestAccountDeletion(@CurrentPrincipal() principal: Principal, @Body() { password }: PasswordDto) {
    await this.auth.requestAccountDeletion(principal.user.id, password)
  }

  @Public()
  @Throttle({ default: {} })
  @HttpCode(204)
  @Post('account/delete/confirm')
  async confirmAccountDeletion(@Body() { token }: TokenDto) {
    await this.auth.confirmAccountDeletion(token)
  }

  private respondWithSession(response: Response, tokens: SessionTokens): IAuthTokenResponse {
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.cookie.secure,
      sameSite: this.cookie.sameSite,
      path: this.cookie.path,
      maxAge: this.cookie.maxAgeMs
    })

    return { accessToken: tokens.accessToken }
  }
}
