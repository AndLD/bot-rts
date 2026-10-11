import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class BaseAlreadyExistsError extends AppError {
  constructor() {
    super(403, ErrorCode.BASE_ALREADY_EXISTS, 'User base already exists')
  }
}

export class BaseLostError extends AppError {
  constructor() {
    super(403, ErrorCode.BASE_LOST, 'The base is lost: deploy a new one')
  }
}
