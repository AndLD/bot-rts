import { AppError } from '../../shared/domain/app-error'
import { API_KEY_LIMITS } from '../../../../lib/utils/interfaces/api-keys'
import { ErrorCode } from '../../../../lib/utils/error-codes'

export class TooManyApiKeysError extends AppError {
  constructor() {
    super(
      409,
      ErrorCode.TOO_MANY_API_KEYS,
      `A player may hold at most ${API_KEY_LIMITS.maxKeysPerPlayer} active API keys`
    )
  }
}

export class ApiKeyScopeError extends AppError {
  constructor(scope: string) {
    super(403, ErrorCode.API_KEY_SCOPE, `This API key does not have the "${scope}" scope`)
  }
}

export class SessionOnlyError extends AppError {
  constructor() {
    super(403, ErrorCode.SESSION_ONLY, 'This is only available to a signed-in session, not to an API key')
  }
}
