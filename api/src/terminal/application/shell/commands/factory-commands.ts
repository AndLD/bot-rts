import { MAX_CRAFT_COUNT } from '../../../../../../lib/utils/interfaces/crafting'
import { AssemblyService } from '../../../../bots/application/assembly.service'
import { FactoryService } from '../../../../bots/application/factory.service'
import { RecipeService } from '../../../../crafting/application/recipe.service'
import { FactoryJob } from '../../../../modules/domain/game-module'
import {
  CommandContext,
  CommandOutcome,
  CommandUsageError,
  output,
  singleArgument,
  TerminalCommand
} from '../terminal-command'

const seconds = (ms: number) => `${Math.max(Math.ceil(ms / 1000), 0)}s`

const jobLine = (job: FactoryJob, now: number) =>
  `- ${job.kind} module="${job.module}" ready in ${seconds(job.readyAt - now)}`

// What the factory of the base is working on and what it holds
export class FactoryCommand implements TerminalCommand {
  readonly names = ['factory']

  constructor(private readonly factory: FactoryService) {}

  async execute({ userId, session }: CommandContext): Promise<CommandOutcome> {
    const status = await this.factory.status(userId, session.botId)
    return output(
      ...status.jobs.map((job) => jobLine(job, status.now)),
      ...status.parts.map((part) => `- part id="${part.id}" module="${part.name}"`),
      ...status.blueprintItems.map((item) => `- blueprint id="${item.id}" module="${item.name}"`)
    )
  }
}

// The recipes with their cost, and what the player may craft or research
export class RecipesCommand implements TerminalCommand {
  readonly names = ['recipes']

  constructor(private readonly recipes: RecipeService) {}

  async execute({ userId }: CommandContext): Promise<CommandOutcome> {
    const recipes = await this.recipes.listFor(userId)
    return output(
      ...recipes.map((recipe) => {
        const cost = recipe.resources.map(({ resource, amount }) => `${amount} ${resource}`).join(', ')
        const state = recipe.isKnown ? 'known' : recipe.canResearch ? 'researchable' : 'locked'
        return `- module="${recipe.module}" ${state} cost="${cost}" time=${seconds(recipe.craftTimeMs)}`
      })
    )
  }
}

export class CraftCommand implements TerminalCommand {
  readonly names = ['craft']

  constructor(private readonly factory: FactoryService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    const usage = `craft <module> [count 1-${MAX_CRAFT_COUNT}]`
    if (args.length < 1 || args.length > 2) {
      throw new CommandUsageError(usage)
    }
    const count = args.length === 2 ? Number(args[1]) : 1
    const jobs = await this.factory.craft(userId, session.botId, args[0], count)
    const last = jobs[jobs.length - 1]
    return output(
      `queued ${jobs.length} x ${args[0]}, the last one is ready at ${new Date(last.readyAt).toISOString()}`
    )
  }
}

export class ResearchCommand implements TerminalCommand {
  readonly names = ['research']

  constructor(private readonly factory: FactoryService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    const module = singleArgument(args, 'research <module>')
    const job = await this.factory.research(userId, session.botId, module)
    return output(`researching ${module}, ready at ${new Date(job.readyAt).toISOString()}`)
  }
}

export class LearnCommand implements TerminalCommand {
  readonly names = ['learn']

  constructor(private readonly factory: FactoryService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    const itemId = singleArgument(args, 'learn <blueprint-id>')
    const blueprint = await this.factory.learn(userId, session.botId, itemId)
    return output(`learned the blueprint of ${blueprint.module}`)
  }
}

// `assemble <label> <part-id>...`: a label of `-` builds a bot without one
export class AssembleCommand implements TerminalCommand {
  readonly names = ['assemble']

  constructor(private readonly assembly: AssemblyService) {}

  async execute({ userId, session, args }: CommandContext): Promise<CommandOutcome> {
    if (args.length < 2) {
      throw new CommandUsageError('assemble <label|-> <part-id>...')
    }
    const [label, ...partIds] = args
    const { bot, mapPoint } = await this.assembly.assemble(userId, {
      baseId: session.botId,
      label: label === '-' ? null : label,
      partIds
    })
    const { x, y } = mapPoint.location
    return output(`assembled bot id="${bot.id}" at ${x},${y}`)
  }
}
