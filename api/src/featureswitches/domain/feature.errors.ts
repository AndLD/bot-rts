import { Feature } from '../../../../lib/utils/interfaces/features'
import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class FeatureDisabledError extends AppError {
  constructor(readonly feature: Feature) {
    super(403, ErrorCode.FEATURE_DISABLED, `The feature "${feature}" is switched off`)
  }
}
