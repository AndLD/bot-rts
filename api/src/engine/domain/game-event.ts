import { Bars } from './radio'

// A place on the map
export interface EventCell {
  x: number
  y: number
  z: number
}

// Someone an event is about: a player, and the bot of theirs it concerns (none for things like a wallet)
export interface EventParty {
  userId: string
  botId: string | null
}

interface Base {
  // The game time in ms
  at: number
  // The first party is the one that acted or whose entity it is
  parties: [EventParty, ...EventParty[]]
  // Where it happened, if anywhere: every player whose live area covers it hears of it too (design §24.1)
  location?: EventCell
}

// Typed facts about the game that the engine reports after the commands of a tick (design §24.1). They never change the
// simulation; the map animations, the achievements and the notifications consume them outside the tick path.
export type GameEvent =
  | (Base & { type: 'BotMoved'; from: EventCell; to: EventCell })
  | (Base & { type: 'ShotFired'; target: EventCell; rounds: number })
  | (Base & { type: 'ShotHit'; hits: number; victimBotId: string })
  | (Base & { type: 'ModuleDamaged'; moduleId: string; condition: number })
  | (Base & { type: 'ModuleBroken'; moduleId: string })
  | (Base & { type: 'ResourceMined'; resource: string; amount: number })
  | (Base & { type: 'DepositDepleted'; resource: string })
  | (Base & { type: 'ScanCompleted'; cells: number })
  | (Base & { type: 'ExecutionFinished'; executionId: string })
  | (Base & { type: 'ExecutionFailed'; executionId: string; reason: string })
  | (Base & { type: 'EnergyLow' })
  | (Base & { type: 'OutOfFuel'; moduleId: string })
  | (Base & { type: 'LiveScanStopped'; moduleId: string })
  | (Base & { type: 'LinkLost' })
  | (Base & {
      type: 'LinkRestored'
      // What happened while the bot was out of reach, as one summary
      missed: { scans: number; events: number; byType: Record<string, number> }
    })
  | (Base & { type: 'LinkWeak'; bars: Bars })

export type GameEventType = GameEvent['type']

// The news about the link itself reaches the player even though the bot it is about is out of reach
export const LINK_EVENTS: ReadonlySet<GameEventType> = new Set(['LinkLost', 'LinkRestored', 'LinkWeak'])
