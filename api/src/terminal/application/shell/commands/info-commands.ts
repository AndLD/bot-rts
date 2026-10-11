import { TERMINAL_COMMANDS } from '../../../../../../lib/utils/interfaces/terminal'
import { BotsService } from '../../../../bots/application/bots.service'
import { CommandContext, CommandOutcome, output, TerminalCommand } from '../terminal-command'

export class HelpCommand implements TerminalCommand {
  readonly names = ['help']

  async execute(): Promise<CommandOutcome> {
    return { result: { type: 'help', commands: TERMINAL_COMMANDS.map(({ name, usage }) => ({ name, usage })) } }
  }
}

export class ClearCommand implements TerminalCommand {
  readonly names = ['clear']

  async execute(): Promise<CommandOutcome> {
    return { result: { type: 'clear' } }
  }
}

export class ExitCommand implements TerminalCommand {
  readonly names = ['exit']

  async execute(): Promise<CommandOutcome> {
    return { result: { type: 'exit' } }
  }
}

// The bots of the player; the one the terminal is open on is marked
export class ListCommand implements TerminalCommand {
  readonly names = ['list']

  constructor(private readonly bots: BotsService) {}

  async execute({ userId, session }: CommandContext): Promise<CommandOutcome> {
    const bots = await this.bots.listUserBots(userId)
    return output(
      ...bots.map((bot) => {
        const label = bot.label ? ` label="${bot.label}"` : ''
        const last = bot.lastPosition ? ` lastPosition="${bot.lastPosition.x},${bot.lastPosition.y}"` : ''
        return `${bot.id === session.botId ? '(current)' : '-'} id="${bot.id}"${label} type="${bot.type}"${last}`
      })
    )
  }
}

export class ModulesCommand implements TerminalCommand {
  readonly names = ['modules']

  constructor(private readonly bots: BotsService) {}

  async execute({ userId, session }: CommandContext): Promise<CommandOutcome> {
    const modules = await this.bots.getBotModules(userId, session.botId)
    return output(...modules.map((module) => `- id="${module.id}" type="${module.type}" name="${module.name}"`))
  }
}
