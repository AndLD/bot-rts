import { Rng } from '../../shared/application/rng'
import { shuffled } from '../domain/shuffle'
import { BotCapacities } from './bot-capacities'
import { LiveExecution } from './live-execution'

export const SCHEDULER = Symbol('Scheduler')

// Decides which executions run in a tick and in what order (design §12.2)
export interface Scheduler {
  // The executions to step this tick, in order. An execution above its bot's parallel limit is left out and stays queued.
  plan(executions: readonly LiveExecution[], tick: number): LiveExecution[]
  // The planned executions the tick cap kept from running; they go first next tick, so nobody is starved
  deferred(executions: readonly LiveExecution[]): void
}

// The fair scheduler (design §12.2): players take turns, in a different seeded order every tick, one execution each per round,
// so a tick that has to stop early has served every player alike; whoever was left out is served first next tick.
export class FairScheduler implements Scheduler {
  private waiting: string[] = []

  constructor(
    private readonly capacities: BotCapacities,
    // The shuffle of a tick is drawn from the generator for `seed ^ tick`
    private readonly createRng: (seed: number) => Rng,
    private readonly seed: number
  ) {}

  plan(executions: readonly LiveExecution[], tick: number): LiveExecution[] {
    const turns = this.byPlayer(this.admitted(executions))
    const shuffledPlayers = shuffled([...turns.keys()], this.createRng(this.seed ^ tick))
    const players = [
      ...this.waiting.filter((player) => turns.has(player)),
      ...shuffledPlayers.filter((player) => !this.waiting.includes(player))
    ]

    const order: LiveExecution[] = []
    for (let round = 0; players.some((player) => (turns.get(player) as LiveExecution[]).length > round); round++) {
      for (const player of players) {
        const next = (turns.get(player) as LiveExecution[])[round]
        if (next) {
          order.push(next)
        }
      }
    }
    return order
  }

  deferred(executions: readonly LiveExecution[]): void {
    this.waiting = [...new Set(executions.map((execution) => execution.record.userId))]
  }

  // The first `parallelExecutions` executions of each bot, oldest first; the rest wait their turn
  private admitted(executions: readonly LiveExecution[]): LiveExecution[] {
    const used = new Map<string, number>()
    return executions.filter((execution) => {
      const botId = execution.record.botId
      const count = used.get(botId) ?? 0
      used.set(botId, count + 1)
      return count < this.capacities.get(botId).parallelExecutions
    })
  }

  private byPlayer(executions: readonly LiveExecution[]): Map<string, LiveExecution[]> {
    const turns = new Map<string, LiveExecution[]>()
    for (const execution of executions) {
      const player = execution.record.userId
      turns.set(player, [...(turns.get(player) ?? []), execution])
    }
    return turns
  }
}
