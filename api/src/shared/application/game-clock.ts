import { configOf, DEFAULT_GAME_TIME_SETTINGS, GameTimeConfig, GameTimeSettings } from '../../../../lib/utils/game-time'
import { Clock } from './clock'

// The clock of the rules of the game (design §12.4): crafting and research timers, the factory's jobs, the time of day, the due times of
// notifications and the engine's own use of time. `CLOCK` stays the real clock for sessions, logins, rate limits, bans, the audit trail
// and database timestamps, so a change of the game's time can never expire a login.
export const GAME_CLOCK = Symbol('GameClock')

// The settings of the game's time in force in this process, and the clock they make
export const GAME_TIME = Symbol('GameTime')

// What the consumers of the time of day read: always the latest settings, never a copy taken at start
export interface GameTimeSource {
  config(): GameTimeConfig
  settings(): GameTimeSettings
}

// The game's time in this process: the real clock plus an offset, and the day cycle. A test server can move the offset forward; in
// production it is always 0, whatever the settings say, so the game's time is the real time.
export class GameTimeState implements GameTimeSource {
  private current: GameTimeSettings
  private latest = 0

  constructor(
    private readonly real: Clock,
    private readonly isProduction: boolean,
    initial: GameTimeSettings = DEFAULT_GAME_TIME_SETTINGS
  ) {
    this.current = initial
  }

  // The game clock: never goes back, except when a new setting lowers the offset on purpose (the reset of a test server)
  readonly clock: Clock = {
    now: () => {
      this.latest = Math.max(this.latest, this.real.now().getTime() + this.offsetMs())

      return new Date(this.latest)
    }
  }

  settings(): GameTimeSettings {
    return this.current
  }

  config(): GameTimeConfig {
    return configOf(this.current)
  }

  offsetMs(): number {
    return this.isProduction ? 0 : this.current.offsetMs
  }

  apply(settings: GameTimeSettings): void {
    if (settings.offsetMs < this.current.offsetMs) {
      this.latest = 0
    }
    this.current = settings
  }
}
