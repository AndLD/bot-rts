import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class UnknownModuleTypeError extends AppError {
  constructor(type: string) {
    super(500, ErrorCode.INTERNAL_ERROR, `No module class is registered for the type ${type}`)
  }
}

export class UnknownModuleError extends AppError {
  constructor(name: string) {
    super(404, ErrorCode.NOT_FOUND, `Unknown module: ${name}`)
  }
}
