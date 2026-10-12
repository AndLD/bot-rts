import { ErrorCode } from '../../../../../lib/utils/error-codes'
import { TerminalCommandResult } from '../../../../../lib/utils/interfaces/terminal'
import { AppError } from '../../../shared/domain/app-error'
import { TerminalSession } from '../../domain/terminal-session'
import { Cwd } from './cwd'

export interface CommandContext {
  readonly userId: string
  readonly session: TerminalSession
  readonly cwd: Cwd
  readonly args: readonly string[]
  // The name the command was called by, and the line after it as typed (code for `eval` must keep its spaces)
  readonly name: string
  readonly rest: string
}

// What a command did: its result and, when it moved, the new place
export interface CommandOutcome {
  readonly result: TerminalCommandResult
  readonly cwd?: Cwd
}

// One terminal command. A new command is a new class in the list the shell is built with (open/closed).
export interface TerminalCommand {
  readonly names: readonly string[]
  execute(context: CommandContext): Promise<CommandOutcome>
}

export const output = (...lines: string[]): CommandOutcome => ({ result: { type: 'output', lines } })

export class UnknownCommandError extends AppError {
  constructor(name: string) {
    super(404, ErrorCode.UNKNOWN_COMMAND, `Unknown command: ${name}`)
  }
}

export class CommandUsageError extends AppError {
  constructor(usage: string) {
    super(400, ErrorCode.COMMAND_USAGE, `Usage: ${usage}`)
  }
}

export class NoDriveSelectedError extends AppError {
  constructor() {
    super(409, ErrorCode.NO_DRIVE_SELECTED, 'No drive selected: use cd <drive>')
  }
}

// The one argument of a command, or the usage error
export function singleArgument(args: readonly string[], usage: string): string {
  if (args.length !== 1) {
    throw new CommandUsageError(usage)
  }
  return args[0]
}

// The drive the session is in, or the error telling the player to pick one
export function requireDrive(cwd: Cwd): string {
  if (!cwd.driveId) {
    throw new NoDriveSelectedError()
  }
  return cwd.driveId
}
