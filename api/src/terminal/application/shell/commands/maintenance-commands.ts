import { MaintenanceService } from '../../../../bots/application/maintenance.service'
import { CommandContext, CommandOutcome, CommandUsageError, output, TerminalCommand } from '../terminal-command'

function twoArguments(args: readonly string[], usage: string): [string, string] {
  if (args.length !== 2) {
    throw new CommandUsageError(usage)
  }
  return [args[0], args[1]]
}

// `repair <bot-id> <module-id>`: one repair operation on a module of a bot on an adjacent cell
export class RepairCommand implements TerminalCommand {
  readonly names = ['repair']

  constructor(private readonly maintenance: MaintenanceService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    const [targetBotId, moduleId] = twoArguments(args, 'repair <bot-id> <module-id>')
    const module = await this.maintenance.repair(userId, { repairerId: session.botId, targetBotId, moduleId })
    return output(`repaired ${module.name}: condition ${module.condition}/${module.maxCondition}`)
  }
}

// `disassemble <bot-id> <module-id>`: takes a module of a bot on an adjacent cell apart into scrap
export class DisassembleCommand implements TerminalCommand {
  readonly names = ['disassemble']

  constructor(private readonly maintenance: MaintenanceService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    const [targetBotId, moduleId] = twoArguments(args, 'disassemble <bot-id> <module-id>')
    const scrap = await this.maintenance.disassemble(userId, { repairerId: session.botId, targetBotId, moduleId })
    const text = scrap.map(({ resource, amount }) => `${amount} ${resource}`).join(', ')
    return output(`disassembled, scrap: ${text || 'nothing'}`)
  }
}
