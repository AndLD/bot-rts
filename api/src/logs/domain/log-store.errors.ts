import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

// The store the console reads the log from does not answer (down, too slow, or it refused the question)
export class LogStoreUnavailableError extends AppError {
  constructor(message = 'The log store cannot be reached') {
    super(503, ErrorCode.LOG_STORE_UNAVAILABLE, message)
  }
}
