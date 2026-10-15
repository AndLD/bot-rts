import { GameTimeConfig } from '../../../../lib/utils/game-time'
import { Clock } from '../../shared/application/clock'
import { GameTimeSource } from '../../shared/application/game-clock'

export interface GameTimeView {
  // The server's game instant in ms, so a client can derive the same in-game time from its synced clock
  now: number
  config: GameTimeConfig
}

export class GameTimeService {
  constructor(
    private readonly clock: Clock,
    private readonly time: GameTimeSource,
    // Read before answering, so that a node that was just told of a change by the socket event is not a second behind
    private readonly settings?: { refresh(): Promise<unknown> }
  ) {}

  async current(): Promise<GameTimeView> {
    await this.settings?.refresh()

    return { now: this.clock.now().getTime(), config: this.time.config() }
  }
}
