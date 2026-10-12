import { ModuleType } from '../../../../lib/utils/interfaces/modules'
import { ErrorCode } from '../../../../lib/utils/error-codes'
import { fail, Result, ResultCode } from '../../../../lib/utils/result'
import { findScriptFunction, isGranted, SCRIPT_FUNCTIONS, validateScriptArgs } from '../../../../lib/utils/script-api'
import { AppError } from '../../shared/domain/app-error'
import { ValidationError } from '../../shared/domain/errors'
import { BotState } from '../domain/bot-state'
import { JsonValue } from '../domain/json-value'
import { ScriptMisuseError } from '../domain/script-misuse'

// What a handler returns: data for the script, or an expected failure
export type CallOutcome = Result<JsonValue | undefined>

// Serves some of the functions of the script API for the bot that called them. One handler per module family, so a new
// family is a new class and the router stays unchanged (AGENTS.md §4).
export interface ScriptFunctionHandler {
  readonly functions: readonly string[]
  handle(bot: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome>
}

const RESULT_CODES: ReadonlySet<string> = new Set(Object.values(ResultCode))

// API error codes that are routine game outcomes for a script, with the result code they become
const RESULT_CODE_OF_ERROR: Readonly<Record<string, ResultCode>> = {
  [ErrorCode.DRIVE_FULL]: ResultCode.NO_SPACE,
  [ErrorCode.DRIVE_BROKEN]: ResultCode.BROKEN_MODULE,
  [ErrorCode.NO_FREE_LOCATION]: ResultCode.NO_SPACE,
  [ErrorCode.ALREADY_EXISTS]: ResultCode.BLOCKED,
  [ErrorCode.BASE_LOST]: ResultCode.FORBIDDEN
}

// The predefined functions are the only door out of the sandbox (design §13): every call is checked against the bot's
// modules and its arguments, then served by the handler of its family, which charges the bot and acts for its owner.
export class ScriptApi {
  private readonly handlers = new Map<string, ScriptFunctionHandler>()

  constructor(handlers: readonly ScriptFunctionHandler[]) {
    for (const handler of handlers) {
      for (const fn of handler.functions) {
        this.handlers.set(fn, handler)
      }
    }
    const unserved = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled && !this.handlers.has(spec.name))
    if (unserved.length) {
      throw new Error(`No handler for the script functions: ${unserved.map((spec) => spec.name).join(', ')}`)
    }
  }

  // Throws ScriptMisuseError for a call that must end the execution; everything else is a Result
  async execute(bot: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const spec = findScriptFunction(fn)
    const handler = this.handlers.get(fn)
    if (!spec || !handler) {
      throw new ScriptMisuseError(`${fn} is not a game function`)
    }
    if (!isGranted(spec, new Set<ModuleType>(bot.modules.map((module) => module.type)))) {
      throw new ScriptMisuseError(`${fn} needs a ${spec.modules.join(' or ')} module`)
    }
    const problem = validateScriptArgs(spec, args)
    if (problem) {
      throw new ScriptMisuseError(problem)
    }

    try {
      return await handler.handle(bot, fn, args)
    } catch (error) {
      return this.asOutcome(error)
    }
  }

  // The use cases signal an expected failure with an error that carries a result code; anything else is misuse or a bug
  private asOutcome(error: unknown): CallOutcome {
    if (error instanceof AppError) {
      const code = RESULT_CODES.has(error.code) ? (error.code as ResultCode) : RESULT_CODE_OF_ERROR[error.code]
      if (code) {
        return fail(code, error.message)
      }
    }
    if (error instanceof ValidationError) {
      throw new ScriptMisuseError(error.message)
    }
    throw error
  }
}
