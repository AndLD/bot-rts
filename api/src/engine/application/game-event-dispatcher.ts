import { Logger } from '../../shared/application/logger'
import { GameEvent } from '../domain/game-event'
import { EnginePort } from './engine-port'

export const GAME_EVENT_CONSUMERS = Symbol('GameEventConsumers')

// Something that reacts to game events (design §24.1): the map animations of the client, achievements (§23), notifications
// (§24.2). It runs in the API process, never on the engine's path.
export interface GameEventConsumer {
  consume(userId: string, event: GameEvent): void | Promise<void>
}

// Hands the game events the engine reports to every consumer, each in turn and apart from the others, so a consumer that is slow
// or fails can neither hold up the engine nor keep another consumer from the event
export class GameEventDispatcher {
  private off: (() => void) | null = null

  constructor(
    private readonly engine: Pick<EnginePort, 'onEvent'>,
    private readonly consumers: readonly GameEventConsumer[],
    private readonly logger: Logger
  ) {}

  start(): void {
    this.off = this.engine.onEvent((event) => {
      if (event.type === 'game') {
        void this.dispatch(event.userId, event.event)
      }
    })
  }

  stop(): void {
    this.off?.()
    this.off = null
  }

  private async dispatch(userId: string, event: GameEvent): Promise<void> {
    for (const consumer of this.consumers) {
      try {
        await consumer.consume(userId, event)
      } catch (error) {
        this.logger.error(error)
      }
    }
  }
}
