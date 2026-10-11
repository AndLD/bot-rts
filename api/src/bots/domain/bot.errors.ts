import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class BaseAlreadyExistsError extends AppError {
  constructor() {
    super(403, ErrorCode.BASE_ALREADY_EXISTS, 'User base already exists')
  }
}

export class NoFreeLocationError extends AppError {
  constructor() {
    super(409, ErrorCode.NO_FREE_LOCATION, 'No free location for the base')
  }
}
