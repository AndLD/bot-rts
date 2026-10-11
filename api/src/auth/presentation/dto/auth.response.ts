import { ApiProperty } from '@nestjs/swagger'
import { IAuthTokenResponse } from '../../../../../lib/utils/interfaces/auth'

export class AuthTokenResponse implements IAuthTokenResponse {
  @ApiProperty({ description: 'The access token; the refresh token travels in an HTTP-only cookie' })
  accessToken!: string
}
