import { BotsService } from '../../../bots/application/bots.service'
import { FilesService } from '../../../files/application/files.service'
import { TerminalService } from '../terminal.service'
import { CatCommand, CdCommand, EditCommand, LsCommand, MkdirCommand, RmCommand } from './commands/file-commands'
import { ClearCommand, ExitCommand, HelpCommand, ListCommand, ModulesCommand } from './commands/info-commands'
import { TerminalShell } from './terminal-shell.service'

// The shell with every command of the base terminal (design §11.1); the commands of later phases are added here
export function createTerminalShell(bots: BotsService, files: FilesService, terminal: TerminalService): TerminalShell {
  return new TerminalShell(
    [
      new HelpCommand(),
      new ClearCommand(),
      new ExitCommand(),
      new ListCommand(bots),
      new ModulesCommand(bots),
      new LsCommand(files),
      new CdCommand(files),
      new MkdirCommand(files),
      new CatCommand(files),
      new EditCommand(files),
      new RmCommand(files)
    ],
    terminal,
    files
  )
}
