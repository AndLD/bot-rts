import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class DriveFullError extends AppError {
  constructor() {
    super(413, ErrorCode.DRIVE_FULL, 'There is not enough space on the drive')
  }
}

export class DriveBrokenError extends AppError {
  constructor() {
    super(409, ErrorCode.DRIVE_BROKEN, 'The drive is broken')
  }
}

export class AlreadyExistsError extends AppError {
  constructor(what: string) {
    super(409, ErrorCode.ALREADY_EXISTS, `${what} already exists`)
  }
}
