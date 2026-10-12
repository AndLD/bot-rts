import { BotPasswordWrongError } from '../../../domain/terminal.errors'
import { BotAccessService } from '../../bot-access.service'
import { Delay } from '../../delay'
import { TerminalService } from '../../terminal.service'
import {
  CommandContext,
  CommandOutcome,
  CommandUsageError,
  output,
  singleArgument,
  TerminalCommand
} from '../terminal-command'

// `passwd <password>`: sets the access password of the bot the terminal is open on (design §11.2.2)
export class PasswdCommand implements TerminalCommand {
  readonly names = ['passwd']

  constructor(private readonly access: BotAccessService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    await this.access.setPassword(userId, session.botId, singleArgument(args, 'passwd <password>'))
    return output('password changed')
  }
}

// `connect <bot-id> [password]`: a terminal on another bot. A foreign bot asks for its password, each try costs energy and takes
// a while (design §11.2.2).
export class ConnectCommand implements TerminalCommand {
  readonly names = ['connect']

  constructor(
    private readonly access: BotAccessService,
    private readonly terminal: TerminalService,
    private readonly delay: Delay,
    private readonly attemptDelayMs: number
  ) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    if (args.length < 1 || args.length > 2) {
      throw new CommandUsageError('connect <bot-id> [password]')
    }
    const [targetId, password] = args
    let connection
    try {
      connection = await this.access.connect(userId, session.botId, targetId, password)
    } catch (error) {
      if (error instanceof BotPasswordWrongError) {
        await this.delay.wait(this.attemptDelayMs)
      }
      throw error
    }
    if (connection.isForeign) {
      await this.delay.wait(this.attemptDelayMs)
    }
    const opened = await this.terminal.openConnection(userId, session.botId, connection.bot.id)
    return { result: { type: 'connected', sessionId: opened.id, botId: opened.botId } }
  }
}

// `adopt`: in a session on a foreign bot, takes the bot into the base the connection came from (design §11.2.2)
export class AdoptCommand implements TerminalCommand {
  readonly names = ['adopt']

  constructor(private readonly access: BotAccessService) {}

  async execute({ userId, session }: CommandContext): Promise<CommandOutcome> {
    if (!session.fromBotId) {
      throw new CommandUsageError('adopt works in a terminal opened with connect on a bot of another player')
    }
    await this.access.adopt(userId, session.fromBotId, session.botId)
    return output('the bot is yours now')
  }
}
