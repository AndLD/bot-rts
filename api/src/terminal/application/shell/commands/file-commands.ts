import { FILE_KIND } from '../../../../../../lib/utils/interfaces/files'
import { DriveInfo, FilesService } from '../../../../files/application/files.service'
import { NotFoundError } from '../../../../shared/domain/errors'
import { pathOnDrive, resolvePlace, TOP } from '../cwd'
import {
  CommandContext,
  CommandOutcome,
  CommandUsageError,
  output,
  requireDrive,
  singleArgument,
  TerminalCommand
} from '../terminal-command'

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// All the commands below work on the drives of the bot the terminal is open on
abstract class FileCommand implements TerminalCommand {
  abstract readonly names: readonly string[]

  constructor(protected readonly files: FilesService) {}

  abstract execute(context: CommandContext): Promise<CommandOutcome>

  protected drivesOf({ userId, session }: CommandContext): Promise<DriveInfo[]> {
    return this.files.listDrives(userId, session.botId)
  }
}

export class LsCommand extends FileCommand {
  readonly names = ['ls', 'dir']

  async execute(context: CommandContext): Promise<CommandOutcome> {
    const { userId, session, cwd, args } = context
    if (args.length > 1) {
      throw new CommandUsageError('ls [dir]')
    }

    const drives = await this.drivesOf(context)
    const place = args.length ? resolvePlace(cwd, drives, args[0]) : cwd
    if (!place.driveId) {
      return output(...drives.map((drive) => `${drive.name}  ${drive.used}/${drive.quota} B`))
    }

    const entries = await this.files.list(userId, session.botId, place.driveId, place.directory ?? undefined)
    return output(
      ...entries.map((entry) =>
        entry.kind === FILE_KIND.DIRECTORY ? `${basename(entry.path)}/` : `${basename(entry.path)}  ${entry.size} B`
      )
    )
  }
}

export class CdCommand extends FileCommand {
  readonly names = ['cd']

  async execute(context: CommandContext): Promise<CommandOutcome> {
    const { userId, session, cwd, args } = context
    if (args.length > 1) {
      throw new CommandUsageError('cd <path>')
    }
    if (!args.length) {
      return { ...output(), cwd: TOP }
    }

    const place = resolvePlace(cwd, await this.drivesOf(context), args[0])
    if (place.driveId && place.directory) {
      await this.files.list(userId, session.botId, place.driveId, place.directory)
    }
    return { ...output(), cwd: place }
  }
}

export class MkdirCommand extends FileCommand {
  readonly names = ['mkdir']

  async execute({ userId, session, cwd, args }: CommandContext): Promise<CommandOutcome> {
    const path = pathOnDrive(cwd, singleArgument(args, 'mkdir <name>'))
    await this.files.makeDirectory(userId, session.botId, requireDrive(cwd), path)
    return output()
  }
}

export class CatCommand extends FileCommand {
  readonly names = ['cat']

  async execute({ userId, session, cwd, args }: CommandContext): Promise<CommandOutcome> {
    const path = pathOnDrive(cwd, singleArgument(args, 'cat <file>'))
    const file = await this.files.read(userId, session.botId, requireDrive(cwd), path)
    return output(...file.content.split('\n'))
  }
}

// Asks the client to open an editor on the file; a file that does not exist yet starts empty
export class EditCommand extends FileCommand {
  readonly names = ['edit']

  async execute({ userId, session, cwd, args }: CommandContext): Promise<CommandOutcome> {
    const argument = singleArgument(args, 'edit <file>')
    const path = pathOnDrive(cwd, argument)
    const driveId = requireDrive(cwd)
    try {
      const file = await this.files.read(userId, session.botId, driveId, path)
      return { result: { type: 'edit', path: argument, content: file.content } }
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { result: { type: 'edit', path: argument, content: '' } }
      }
      throw error
    }
  }
}

export class RmCommand extends FileCommand {
  readonly names = ['rm']

  async execute({ userId, session, cwd, args }: CommandContext): Promise<CommandOutcome> {
    const path = pathOnDrive(cwd, singleArgument(args, 'rm <file>'))
    await this.files.remove(userId, session.botId, requireDrive(cwd), path)
    return output()
  }
}
