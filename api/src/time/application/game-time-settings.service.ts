import { DEFAULT_GAME_TIME_SETTINGS, gameTimeProblems, GameTimeSettings } from '../../../../lib/utils/game-time'
import { Clock } from '../../shared/application/clock'
import { GameTimeState } from '../../shared/application/game-clock'
import { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'

export const GAME_TIME_STORE = Symbol('GameTimeStore')

export interface StoredGameTime {
  settings: GameTimeSettings
  updatedAt: Date | null
}

// Where the settings of the game's time are kept: one document of the game settings, shared by every process
export interface GameTimeStore {
  load(): Promise<StoredGameTime>
  save(settings: GameTimeSettings, at: Date): Promise<void>
}

export type GameTimeListener = (settings: GameTimeSettings) => void | Promise<void>

const sameSettings = (a: GameTimeSettings, b: GameTimeSettings): boolean => JSON.stringify(a) === JSON.stringify(b)

// The game's time as a runtime setting that every process follows (design §12.4, §25.3). A change is stored, applied here, and told to
// the listeners (the engine, the connected clients). The other processes read the store: the API nodes about once a second, the engine
// thread when it starts and about every few seconds; a change reaches them at once through the engine link and the socket event.
export class GameTimeSettingsService {
  private readonly listeners: GameTimeListener[] = []

  constructor(
    private readonly store: GameTimeStore,
    private readonly state: GameTimeState,
    private readonly clock: Clock,
    private readonly logger: Logger
  ) {}

  onChange(listener: GameTimeListener): void {
    this.listeners.push(listener)
  }

  current(): GameTimeSettings {
    return this.state.settings()
  }

  // Reads the store and follows it; a store that cannot be read leaves the settings as they are
  async refresh(): Promise<GameTimeSettings> {
    try {
      const { settings } = await this.store.load()

      if (!sameSettings(settings, this.state.settings())) {
        this.state.apply(settings)
      }
    } catch (error) {
      this.logger.error(`The game time settings could not be read: ${(error as Error).message}`)
    }

    return this.state.settings()
  }

  // Stores the settings, applies them here and tells the listeners; the controller adds the reason and the audit entry
  async update(
    next: GameTimeSettings,
    options: { isResetOfOffset?: boolean } = {}
  ): Promise<{ before: GameTimeSettings; after: GameTimeSettings }> {
    const problems = gameTimeProblems(next)

    if (problems.length) {
      throw new ValidationError(problems.join('; '))
    }
    const before = (await this.store.load()).settings

    if (next.offsetMs < before.offsetMs && !options.isResetOfOffset) {
      throw new ValidationError('The game clock cannot be moved back')
    }
    await this.store.save(next, this.clock.now())
    this.state.apply(next)
    for (const listener of this.listeners) {
      try {
        await listener(next)
      } catch (error) {
        this.logger.error(`A game time listener failed: ${(error as Error).message}`)
      }
    }

    return { before, after: next }
  }

  defaults(): GameTimeSettings {
    return DEFAULT_GAME_TIME_SETTINGS
  }
}
