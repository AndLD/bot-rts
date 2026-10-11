import { Failure, Result, ResultCode } from '../../../../lib/utils/result'
import { AppError } from './app-error'

const STATUS_BY_CODE: Partial<Record<ResultCode, number>> = {
  [ResultCode.FORBIDDEN]: 403,
  [ResultCode.NOT_FOUND]: 404
}

// An action that did not succeed, as an HTTP-facing error: a conflict with the state of the world unless it says more
export class ActionFailedError extends AppError {
  constructor(failure: Failure) {
    super(STATUS_BY_CODE[failure.code] ?? 409, failure.code, failure.msg)
  }
}

// The data of a successful result; a failure becomes an exception for the transport layer to map
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new ActionFailedError(result)
  }
  return result.data
}
