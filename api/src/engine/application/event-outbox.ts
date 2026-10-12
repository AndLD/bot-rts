import { Clock } from '../../shared/application/clock'
import { GameEvent } from '../domain/game-event'

// Where the rules and commands put the events they cause while a tick runs; the bus takes them after the commands of the tick
export class EventOutbox {
  private events: GameEvent[] = []

  constructor(private readonly clock: Clock) {}

  // The game time for the `at` of an event
  now(): number {
    return this.clock.now().getTime()
  }

  publish(event: GameEvent): void {
    this.events.push(event)
  }

  drain(): GameEvent[] {
    const events = this.events
    this.events = []
    return events
  }
}
