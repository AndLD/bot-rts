import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class TwoFactorRequiredError extends AppError {
  constructor() {
    super(403, ErrorCode.TWO_FACTOR_REQUIRED, 'Two-factor verification is required for the admin console')
  }
}

export class TwoFactorInvalidError extends AppError {
  constructor() {
    super(403, ErrorCode.TWO_FACTOR_INVALID, 'The verification code is not valid')
  }
}

export class AdminIpNotAllowedError extends AppError {
  constructor() {
    super(403, ErrorCode.ADMIN_IP_NOT_ALLOWED, 'The admin console is not available from this address')
  }
}
