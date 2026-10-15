import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class ViewAsReadOnlyError extends AppError {
  constructor() {
    super(403, ErrorCode.VIEW_AS_READ_ONLY, "This session only views a player's game; it cannot change anything")
  }
}
