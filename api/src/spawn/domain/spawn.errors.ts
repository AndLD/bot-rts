import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class SpawnSeedClosedError extends AppError {
  constructor() {
    super(409, ErrorCode.SPAWN_SEED_CLOSED, 'The spawn seed is closed')
  }
}

export class SpawnSeedFullError extends AppError {
  constructor() {
    super(409, ErrorCode.SPAWN_SEED_FULL, 'The spawn seed is full')
  }
}

export class NoFreeLocationError extends AppError {
  constructor(message = 'No free location for the base') {
    super(409, ErrorCode.NO_FREE_LOCATION, message)
  }
}
