import type { GameEvent } from '../../engine/domain/game-event'
import type { Counter } from './achievement-definitions'

type Deltas = Partial<Record<Counter, number>>

const distance = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))

// What a game event adds to the counters of the player who caused it (design §23.1). Events that no achievement counts add nothing.
export function countersOf(event: GameEvent): Deltas {
  switch (event.type) {
    case 'BaseDeployed':
      return { basesDeployed: 1 }
    case 'ExecutionFinished':
    case 'ExecutionFailed':
      return { scriptRuns: 1 }
    case 'ScanCompleted':
      return { cellsScanned: event.cells }
    case 'ResourceMined':
      return { unitsMined: event.amount }
    case 'CraftOrdered':
      return { modulesCrafted: event.count }
    case 'BotAssembled':
      return { botsAssembled: 1 }
    case 'ModuleRepaired':
      return { modulesRepaired: 1 }
    case 'ModuleDisassembled':
      return { modulesDisassembled: 1 }
    case 'BotAdopted':
      return { botsAdopted: 1 }
    case 'ShotHit':
      return { shotsHit: event.hits }
    case 'BotMoved':
      return { cellsTravelled: distance(event.from, event.to) }
    default:
      return {}
  }
}
