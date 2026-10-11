import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class TerminalSessionClosedError extends AppError {
  constructor() {
    super(409, ErrorCode.TERMINAL_SESSION_CLOSED, 'The terminal session is closed')
  }
}
