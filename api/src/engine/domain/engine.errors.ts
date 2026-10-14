import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, 'The game engine is not running')
  }
}

// A script file, or one it imports, cannot be loaded: missing, too big, not valid code, or an import that is not allowed
export class ScriptLoadError extends AppError {
  constructor(message: string) {
    super(400, ErrorCode.SCRIPT_LOAD_FAILED, message)
  }
}

// A manual action of a category that is switched off, in the game or in the player's own settings (design §15.1)
export class ManualCategoryDisabledError extends AppError {
  constructor(category: string) {
    super(403, ErrorCode.MANUAL_CATEGORY_DISABLED, `Manual control of ${category} is switched off`)
  }
}

// The world is paused for maintenance (design §25.3)
export class MaintenanceModeError extends AppError {
  constructor() {
    super(503, ErrorCode.MAINTENANCE_MODE, 'The game is paused for maintenance')
  }
}

export class ScriptsHaltedError extends AppError {
  constructor() {
    super(503, ErrorCode.SCRIPTS_HALTED, 'Scripts are switched off')
  }
}

export class PlayerQuarantinedError extends AppError {
  constructor() {
    super(403, ErrorCode.PLAYER_QUARANTINED, 'The account is quarantined')
  }
}
