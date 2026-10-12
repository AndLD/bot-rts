import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, 'The game engine is not running')
  }
}

// A script file, or one it imports, cannot be loaded: missing, too big, not valid code, or an import that is not allowed
export class ScriptLoadError extends AppError {
  constructor(message: string) {
    super(400, ErrorCode.SCRIPT_LOAD_FAILED, message)
  }
}
