import type { GameEventType } from '../../../../lib/utils/interfaces/events'

// The facts the engine reports are shared with the client (lib), which animates and narrates them (design §24.1)
export type { EventCell, EventParty, GameEvent, GameEventType } from '../../../../lib/utils/interfaces/events'

// The news about the link itself reaches the player even though the bot it is about is out of reach
export const LINK_EVENTS: ReadonlySet<GameEventType> = new Set(['LinkLost', 'LinkRestored', 'LinkWeak'])
