import { IExecution } from '../../../../../../lib/utils/interfaces/executions'
import { FilesService } from '../../../../files/application/files.service'
import { NotFoundError } from '../../../../shared/domain/errors'
import { AppError } from '../../../../shared/domain/app-error'
import { ScriptArgument, ScriptRunner } from '../../script-runner'
import { pathOnDrive } from '../cwd'
import {
  CommandContext,
  CommandOutcome,
  CommandUsageError,
  NoDriveSelectedError,
  output,
  requireDrive,
  singleArgument,
  TerminalCommand,
  UnknownCommandError
} from '../terminal-command'

const NUMBER = /^-?\d+(\.\d+)?$/
const BOOLEANS = new Map([
  ['true', true],
  ['false', false]
])

// What the player typed after the file name, as the values `main` receives: numbers and booleans, otherwise text
export function toScriptArguments(args: readonly string[]): ScriptArgument[] {
  return args.map((arg) => (NUMBER.test(arg) ? Number(arg) : (BOOLEANS.get(arg) ?? arg)))
}

const summary = ({ id, botId, file, state, restarts }: IExecution) =>
  `id="${id}" bot="${botId}" file="${file}" state="${state}"${restarts ? ` restarts=${restarts}` : ''}`

// `run <file> [args…]`: starts a script of the bot the terminal is open on. Its output arrives as it is written (design §11.1).
export class RunCommand implements TerminalCommand {
  readonly names = ['run']

  constructor(
    protected readonly runner: ScriptRunner,
    protected readonly files: FilesService
  ) {}

  async execute(context: CommandContext): Promise<CommandOutcome> {
    const [file, ...args] = context.args
    if (file === undefined) {
      throw new CommandUsageError('run <file> [args...]')
    }
    return this.start(context, file, args)
  }

  protected async start(
    { userId, session, cwd }: CommandContext,
    file: string,
    args: readonly string[]
  ): Promise<CommandOutcome> {
    const drives = await this.files.listDrives(userId, session.botId)
    const path = file.startsWith('/')
      ? file
      : `/${this.driveNameOf(drives, requireDrive(cwd))}/${pathOnDrive(cwd, file)}`
    const execution = await this.runner.start(userId, session.botId, path, toScriptArguments(args))
    return output(`started ${execution.id}`)
  }

  private driveNameOf(drives: readonly { id: string; name: string }[], driveId: string): string {
    return (drives.find((drive) => drive.id === driveId) as { name: string }).name
  }
}

// `<file> [args…]`: a command that is not one runs the script of that name, like `run <file>`
export class ScriptFileCommand extends RunCommand {
  readonly names = []

  async execute(context: CommandContext): Promise<CommandOutcome> {
    try {
      return await this.start(context, context.name, context.args)
    } catch (error) {
      // No file of that name, or nowhere to look for it: the player typed something that is no command
      if (error instanceof NoDriveSelectedError || (error instanceof AppError && error.statusCode === 404)) {
        throw new UnknownCommandError(context.name)
      }
      throw error
    }
  }
}

// `eval <code>`: runs a line of the shell mode with the bot in scope
export class EvalCommand implements TerminalCommand {
  readonly names = ['eval']

  constructor(private readonly runner: ScriptRunner) {}

  async execute({ userId, session, rest }: CommandContext): Promise<CommandOutcome> {
    if (!rest) {
      throw new CommandUsageError('eval <code>')
    }
    const execution = await this.runner.evaluate(userId, session.botId, rest)
    return output(`started ${execution.id}`)
  }
}

export class TopCommand implements TerminalCommand {
  readonly names = ['top']

  constructor(private readonly runner: ScriptRunner) {}

  async execute({ userId }: CommandContext): Promise<CommandOutcome> {
    const running = await this.runner.list(userId)
    return output(...running.map((execution) => `- ${summary(execution)}`))
  }
}

export class KillCommand implements TerminalCommand {
  readonly names = ['kill']

  constructor(private readonly runner: ScriptRunner) {}

  // The id may be shortened to the characters `top` and the terminal show, as long as it names one running execution
  async execute({ userId, args }: CommandContext): Promise<CommandOutcome> {
    const wanted = singleArgument(args, 'kill <execution-id>')
    const matches = (await this.runner.list(userId)).filter(({ id }) => id.startsWith(wanted))
    if (matches.length !== 1) {
      throw new NotFoundError(matches.length ? 'More than one execution has this id' : 'No such running execution')
    }
    const execution = await this.runner.kill(userId, matches[0].id)
    return output(`killed ${execution.id}`)
  }
}
