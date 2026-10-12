import { AssemblyService } from '../../../bots/application/assembly.service'
import { MaintenanceService } from '../../../bots/application/maintenance.service'
import { FactoryService } from '../../../bots/application/factory.service'
import { RecipeService } from '../../../crafting/application/recipe.service'
import { BotsService } from '../../../bots/application/bots.service'
import { FilesService } from '../../../files/application/files.service'
import { ScriptRunner } from '../script-runner'
import { TerminalService } from '../terminal.service'
import { CatCommand, CdCommand, EditCommand, LsCommand, MkdirCommand, RmCommand } from './commands/file-commands'
import { ClearCommand, ExitCommand, HelpCommand, ListCommand, ModulesCommand } from './commands/info-commands'
import {
  AssembleCommand,
  CraftCommand,
  FactoryCommand,
  LearnCommand,
  RecipesCommand,
  ResearchCommand
} from './commands/factory-commands'
import { DisassembleCommand, RepairCommand } from './commands/maintenance-commands'
import { EvalCommand, KillCommand, RunCommand, ScriptFileCommand, TopCommand } from './commands/script-commands'
import { TerminalShell } from './terminal-shell.service'

// The shell with every command of the base terminal (design §11.1); the commands of later phases are added here
export function createTerminalShell(
  bots: BotsService,
  files: FilesService,
  terminal: TerminalService,
  factory: FactoryService,
  assembly: AssemblyService,
  recipes: RecipeService,
  maintenance: MaintenanceService,
  scripts: ScriptRunner
): TerminalShell {
  return new TerminalShell(
    [
      new HelpCommand(),
      new ClearCommand(),
      new ExitCommand(),
      new ListCommand(bots),
      new ModulesCommand(bots),
      new RecipesCommand(recipes),
      new FactoryCommand(factory),
      new CraftCommand(factory),
      new ResearchCommand(factory),
      new LearnCommand(factory),
      new AssembleCommand(assembly),
      new RepairCommand(maintenance),
      new DisassembleCommand(maintenance),
      new LsCommand(files),
      new CdCommand(files),
      new MkdirCommand(files),
      new CatCommand(files),
      new EditCommand(files),
      new RmCommand(files),
      new RunCommand(scripts, files),
      new EvalCommand(scripts),
      new TopCommand(scripts),
      new KillCommand(scripts)
    ],
    terminal,
    files,
    new ScriptFileCommand(scripts, files)
  )
}
