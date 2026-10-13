import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../../shared/domain/app-error'

export class TerminalSessionClosedError extends AppError {
  constructor() {
    super(409, ErrorCode.TERMINAL_SESSION_CLOSED, 'The terminal session is closed')
  }
}

// What was tried, for the owner of the bot to hear of it (design §24.2)
export interface FailedAttempt {
  targetBotId: string
  ownerId: string | null
  isLockedOut: boolean
}

export class BotPasswordWrongError extends AppError {
  constructor(readonly attempt?: FailedAttempt) {
    super(403, ErrorCode.BOT_PASSWORD_WRONG, 'The password is wrong')
  }
}

// Too many wrong passwords in a row: the bot takes no foreign connections for a while (design §11.2.2)
export class BotLockedError extends AppError {
  constructor() {
    super(423, ErrorCode.BOT_LOCKED, 'The bot refuses connections for now: too many wrong passwords')
  }
}

export class CannotAdoptBaseError extends AppError {
  constructor() {
    super(409, ErrorCode.CANNOT_ADOPT_BASE, 'A base cannot be adopted')
  }
}
