import type { GameEvent } from '../domain/game-event'
import type { FactoryJob } from '../../modules/domain/game-module'
import type { WorldActionName } from './world-actions'
import { controlledBotOf } from './world-actions'

type EventBody = Omit<GameEvent, 'at' | 'parties'>

type Maker = (args: readonly unknown[], result: unknown) => EventBody

// The events a world action causes once it has succeeded (design §24.1): achievements and notifications learn of what a player
// ordered through them. Actions that are not worth an event (files, scans, which scan events already tell of) have none.
const MAKERS: Partial<Record<WorldActionName, Maker>> = {
  'bots.deployUserBase': () => ({ type: 'BaseDeployed' }),
  'factory.craft': (args, result) => {
    const jobs = result as FactoryJob[]

    return {
      type: 'CraftOrdered',
      module: args[2] as string,
      count: jobs.length,
      readyAt: jobs[jobs.length - 1].readyAt
    }
  },
  'factory.research': (args, result) => ({
    type: 'ResearchOrdered',
    module: args[2] as string,
    readyAt: (result as FactoryJob).readyAt
  }),
  'assembly.assemble': (_args, result) => ({
    type: 'BotAssembled',
    newBotId: (result as { bot: { id: string } }).bot.id
  }),
  'maintenance.repair': (args) => {
    const order = args[1] as { targetBotId: string; moduleId: string }

    return { type: 'ModuleRepaired', targetBotId: order.targetBotId, moduleId: order.moduleId }
  },
  'maintenance.disassemble': (args) => {
    const order = args[1] as { targetBotId: string; moduleId: string }

    return { type: 'ModuleDisassembled', targetBotId: order.targetBotId, moduleId: order.moduleId }
  },
  'access.adopt': (args) => ({ type: 'BotAdopted', adoptedBotId: args[2] as string })
} as const

// The user who gave the order is the first argument of every action; the bot it concerns is the one it takes control of
export function worldActionEvents(
  name: WorldActionName,
  args: readonly unknown[],
  result: unknown,
  at: number
): GameEvent[] {
  const make = MAKERS[name]

  if (!make) {
    return []
  }

  // A deployed base is the only order that controls no bot, and the only one whose first argument is the user and not their id
  const isDeploy = name === 'bots.deployUserBase'
  const userId = isDeploy ? (args[0] as { id: string }).id : (args[0] as string)
  const botId = isDeploy
    ? (result as { bot: { id: string } }).bot.id
    : (controlledBotOf(name, args) as { botId: string }).botId

  return [{ ...make(args, result), at, parties: [{ userId, botId }] } as GameEvent]
}
