import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class InvalidTokenError extends AppError {
  constructor() {
    super(400, ErrorCode.INVALID_TOKEN, 'The link is invalid or has expired')
  }
}

export class AccessTokenExpiredError extends AppError {
  constructor() {
    super(401, ErrorCode.TOKEN_EXPIRED, 'The access token has expired')
  }
}

export class WrongPasswordError extends AppError {
  constructor() {
    super(400, ErrorCode.WRONG_PASSWORD, 'The current password is wrong')
  }
}
