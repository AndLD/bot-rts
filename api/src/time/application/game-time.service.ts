import { Clock } from '../../shared/application/clock'
import { GameTimeConfig } from '../../../../lib/utils/game-time'

export interface GameTimeView {
  // The server's instant in ms, so a client can derive the same in-game time from its synced clock
  now: number
  config: GameTimeConfig
}

export class GameTimeService {
  constructor(
    private readonly clock: Clock,
    private readonly config: GameTimeConfig
  ) {}

  current(): GameTimeView {
    return { now: this.clock.now().getTime(), config: this.config }
  }
}
