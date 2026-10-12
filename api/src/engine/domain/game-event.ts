import { Bars } from './radio'

// Typed facts about the game that the engine reports after the commands of a tick (design §24.1). They never change the
// simulation. The audience rules and the consumers (animations, achievements, notifications) are the event bus of task 5.10.
export type GameEvent =
  | { type: 'LinkLost'; userId: string; botId: string; at: number }
  | {
      type: 'LinkRestored'
      userId: string
      botId: string
      at: number
      // What happened while the bot was out of reach, as one summary
      missed: { scans: number; events: number; byType: Record<string, number> }
    }
  // The signal of a bot fell to one bar
  | { type: 'LinkWeak'; userId: string; botId: string; at: number; bars: Bars }
