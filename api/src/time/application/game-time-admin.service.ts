import {
  ADVANCE_STEPS_MS,
  GameTimeSettings,
  IGameTimeAdmin,
  withAdvance,
  withCycle,
  withDayLength,
  withRealWorld,
  withTimeOfDay
} from '../../../../lib/utils/game-time'
import { Clock } from '../../shared/application/clock'
import { GameTimeSource } from '../../shared/application/game-clock'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { GameTimeSettingsService } from './game-time-settings.service'

export interface GameTimeChange {
  before: GameTimeSettings
  after: GameTimeSettings
}

const MINUTES_PER_DAY = 24 * 60

// What an admin does to the game's time (design §25.3, Game time): set the time of day, change the day length without a jump, show the
// wall-clock time of a zone, and (on a test server) move the clock forward. Each is computed at the instant of the call, stored through
// the settings service and so told to the engine and to every client; the controller adds the reason and the audit entry.
export class GameTimeAdminService {
  constructor(
    private readonly settings: GameTimeSettingsService,
    private readonly time: GameTimeSource,
    private readonly clock: Clock,
    private readonly canAdvance: boolean
  ) {}

  async view(): Promise<IGameTimeAdmin> {
    const settings = await this.settings.refresh()

    return { settings, config: this.time.config(), now: this.clock.now().getTime(), canAdvance: this.canAdvance }
  }

  // `minuteOfDay` counts from 00:00: 990 is 16:30
  async setTimeOfDay(minuteOfDay: number): Promise<GameTimeChange> {
    if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
      throw new ValidationError('The time of day must be a minute from 0 to 1439')
    }

    return this.change((settings, now) => withTimeOfDay(settings, now, minuteOfDay / 60))
  }

  setDayLength(dayLengthMs: number): Promise<GameTimeChange> {
    return this.change((settings, now) => withDayLength(settings, now, dayLengthMs))
  }

  setRealWorld(timeZone: string): Promise<GameTimeChange> {
    return this.change((settings) => withRealWorld(settings, timeZone))
  }

  leaveRealWorld(): Promise<GameTimeChange> {
    return this.change((settings, now) => withCycle(settings, now))
  }

  async advance(stepMs: number): Promise<GameTimeChange> {
    if (!this.canAdvance) {
      throw new ForbiddenError('The game clock can only be advanced on a test server')
    }
    if (!(ADVANCE_STEPS_MS as readonly number[]).includes(stepMs)) {
      throw new ValidationError('The game clock moves by 1 minute, 1 hour or 1 day')
    }

    return this.change((settings) => withAdvance(settings, stepMs))
  }

  private async change(next: (settings: GameTimeSettings, nowMs: number) => GameTimeSettings): Promise<GameTimeChange> {
    const current = await this.settings.refresh()

    return this.settings.update(next(current, this.clock.now().getTime()))
  }
}
