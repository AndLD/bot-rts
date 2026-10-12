import { LINK_EVENTS } from '../domain/game-event'
import { EventOutbox } from './event-outbox'
import { EngineSink } from './engine-ports'
import { RadioBuffers } from './radio-buffers'

// What the bus needs to know about who can hear what
export interface EventAudience {
  // The players whose live area covers a cell
  watchersOf(location: { x: number; y: number; z: number }): string[]
  // Whether a bot reaches its base, so that its owner hears of it now
  isConnected(userId: string, botId: string): boolean
}

// The game event bus (design §24.1). Commands and rules publish events while a tick runs; after the commands of the tick the
// bus works out who hears each one and hands it over, so nothing here is on the path of the simulation:
//  (a) a player hears of what concerns their own bots, bases, modules and items, but for a bot only while it is connected to the
//      base network (design §11.2.1); what a bot out of reach would have told is kept for the summary when the link returns;
//  (b) the player who acted hears the direct result of their action (the first party of every event is the actor);
//  (c) everybody whose live area (§4.4) covers the place hears of what happens there, whoever caused it.
export class GameEventBus {
  constructor(
    private readonly outbox: EventOutbox,
    private readonly audience: EventAudience,
    private readonly buffers: RadioBuffers,
    private readonly sink: EngineSink
  ) {}

  // After the commands of a tick: delivers what was published, each event once per recipient
  deliver(): void {
    for (const event of this.outbox.drain()) {
      const heard = new Set<string>()
      for (const { userId, botId } of event.parties) {
        if (botId && !LINK_EVENTS.has(event.type) && !this.audience.isConnected(userId, botId)) {
          this.buffers.keepEvent(botId, event)
        } else {
          heard.add(userId)
        }
      }
      if (event.location) {
        this.audience.watchersOf(event.location).forEach((userId) => heard.add(userId))
      }
      for (const userId of [...heard].sort()) {
        this.sink.emit({ type: 'game', userId, event })
      }
    }
  }
}
