import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class UnknownRecipeError extends AppError {
  constructor(module: string) {
    super(404, ErrorCode.NOT_FOUND, `No recipe for the module ${module}`)
  }
}
