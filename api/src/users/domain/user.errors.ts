import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(400, ErrorCode.EMAIL_ALREADY_EXISTS, 'Email already exists')
  }
}

export class CredentialsInvalidError extends AppError {
  constructor() {
    super(401, ErrorCode.CREDENTIALS_INVALID, 'Email or password is invalid')
  }
}

export class UserBannedError extends AppError {
  constructor() {
    super(403, ErrorCode.USER_BANNED, 'User is banned')
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor() {
    super(403, ErrorCode.EMAIL_NOT_VERIFIED, 'Email is not verified')
  }
}
