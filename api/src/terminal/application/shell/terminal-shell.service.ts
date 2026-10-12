import {
  TERMINAL_LOG_KIND,
  ITerminalCommandResponse,
  ITerminalCwd,
  TerminalCommandResult
} from '../../../../../lib/utils/interfaces/terminal'
import { FilesService } from '../../../files/application/files.service'
import { File } from '../../../files/domain/file.entity'
import { AppError } from '../../../shared/domain/app-error'
import { TerminalService } from '../terminal.service'
import { Cwd, pathOnDrive, TOP } from './cwd'
import { parseCommandLine } from './command-line'
import { requireDrive, TerminalCommand } from './terminal-command'

export interface ShellReply {
  readonly response: ITerminalCommandResponse
  readonly cwd: Cwd
}

// Runs the lines typed in a terminal session: finds the command, runs it, stores the line and its output in the session
export class TerminalShell {
  private readonly commands = new Map<string, TerminalCommand>()

  constructor(
    commands: readonly TerminalCommand[],
    private readonly terminal: TerminalService,
    private readonly files: FilesService,
    // Runs a line that names no command (`<file>` runs a script)
    private readonly fallback: TerminalCommand
  ) {
    for (const command of commands) {
      for (const name of command.names) {
        this.commands.set(name, command)
      }
    }
  }

  async execute(userId: string, sessionId: string, line: string, cwd: Cwd): Promise<ShellReply> {
    const session = await this.terminal.getOpenSession(userId, sessionId)
    const parsed = parseCommandLine(line)
    if (!parsed) {
      return this.reply(userId, session.botId, { type: 'output', lines: [] }, cwd)
    }

    await this.terminal.record(userId, sessionId, TERMINAL_LOG_KIND.INPUT, line.trim())

    let result: TerminalCommandResult
    let place = cwd
    try {
      const command = this.commands.get(parsed.name) ?? this.fallback
      const outcome = await command.execute({
        userId,
        session,
        cwd,
        args: parsed.args,
        name: parsed.name,
        rest: parsed.rest
      })
      result = outcome.result
      place = outcome.cwd ?? cwd
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error
      }
      result = { type: 'error', code: error.code, message: error.message }
    }

    await this.recordResult(userId, sessionId, result)
    return this.reply(userId, session.botId, result, place)
  }

  // Saves what the player wrote in the editor an `edit` result opened, into the directory the session is in
  async saveFile(userId: string, sessionId: string, cwd: Cwd, path: string, content: string): Promise<File> {
    const session = await this.terminal.getOpenSession(userId, sessionId)
    const file = await this.files.write(userId, session.botId, requireDrive(cwd), pathOnDrive(cwd, path), content)
    await this.terminal.record(userId, sessionId, TERMINAL_LOG_KIND.OUTPUT, `saved ${file.path} (${file.size} B)`)
    return file
  }

  private async recordResult(userId: string, sessionId: string, result: TerminalCommandResult) {
    if (result.type === 'error') {
      await this.terminal.record(userId, sessionId, TERMINAL_LOG_KIND.ERROR, result.message)
    } else if (result.type === 'output' && result.lines.length) {
      await this.terminal.record(userId, sessionId, TERMINAL_LOG_KIND.OUTPUT, result.lines.join('\n'))
    }
  }

  // The reply with the place as the player sees it (the drive by name); a drive that is gone sends the session back to
  // the top
  private async reply(userId: string, botId: string, result: TerminalCommandResult, cwd: Cwd): Promise<ShellReply> {
    const drive = cwd.driveId ? (await this.files.listDrives(userId, botId)).find((d) => d.id === cwd.driveId) : null
    const place = drive ? cwd : TOP
    const described: ITerminalCwd = drive
      ? { drive: drive.name, directory: cwd.directory }
      : { drive: null, directory: null }
    return { response: { result, cwd: described }, cwd: place }
  }
}
