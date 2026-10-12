import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, 'The game engine is not running')
  }
}
