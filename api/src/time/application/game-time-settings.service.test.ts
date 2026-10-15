import { DEFAULT_GAME_TIME_SETTINGS, GameTimeSettings } from '../../../../lib/utils/game-time'
import { FakeClock } from '../../../tests/fakes/fakes'
import { GameTimeState } from '../../shared/application/game-clock'
import { ValidationError } from '../../shared/domain/errors'
import { GameTimeSettingsService, GameTimeStore } from './game-time-settings.service'

class MemoryStore implements GameTimeStore {
  settings: GameTimeSettings = DEFAULT_GAME_TIME_SETTINGS
  updatedAt: Date | null = null
  isDown = false

  async load() {
    if (this.isDown) {
      throw new Error('down')
    }
    return { settings: this.settings, updatedAt: this.updatedAt }
  }

  async save(settings: GameTimeSettings, at: Date) {
    this.settings = settings
    this.updatedAt = at
  }
}

function setup() {
  const store = new MemoryStore()
  const clock = new FakeClock()
  const state = new GameTimeState(clock, false)
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const service = new GameTimeSettingsService(store, state, clock, logger)

  return { store, clock, state, logger, service }
}

const next = (overrides: Partial<GameTimeSettings>): GameTimeSettings => ({
  ...DEFAULT_GAME_TIME_SETTINGS,
  ...overrides
})

describe('GameTimeSettingsService', () => {
  it('follows the store: applies what another process stored, and leaves what did not change', async () => {
    const { service, store, state } = setup()
    const apply = jest.spyOn(state, 'apply')

    await service.refresh()
    expect(apply).not.toHaveBeenCalled()
    store.settings = next({ dayLengthMs: 120_000 })
    expect(await service.refresh()).toEqual(next({ dayLengthMs: 120_000 }))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(service.current().dayLengthMs).toBe(120_000)
  })

  it('keeps the settings in force when the store cannot be read, and says so', async () => {
    const { service, store, logger } = setup()
    store.isDown = true

    expect(await service.refresh()).toEqual(DEFAULT_GAME_TIME_SETTINGS)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('down'))
  })

  it('stores a change, applies it here and tells the listeners, in that order', async () => {
    const { service, store, state, clock } = setup()
    const seen: unknown[] = []
    service.onChange((settings) => {
      seen.push({ stored: store.settings, applied: state.settings(), settings })
    })

    const { before, after } = await service.update(next({ anchorMs: 99 }))

    expect(before).toEqual(DEFAULT_GAME_TIME_SETTINGS)
    expect(after.anchorMs).toBe(99)
    expect(store.updatedAt).toEqual(clock.now())
    expect(seen).toEqual([{ stored: after, applied: after, settings: after }])
  })

  it('carries on when a listener fails, and logs it', async () => {
    const { service, logger } = setup()
    const second = jest.fn()
    service.onChange(() => {
      throw new Error('socket is gone')
    })
    service.onChange(second)

    await service.update(next({ anchorMs: 1 }))

    expect(second).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('socket is gone'))
  })

  it('refuses settings that are not valid, and a move of the clock back, but allows the reset of a test server', async () => {
    const { service, store } = setup()

    await expect(service.update(next({ dayLengthMs: 10 }))).rejects.toThrow(ValidationError)
    await service.update(next({ offsetMs: 5000 }))
    await expect(service.update(next({ offsetMs: 1000 }))).rejects.toThrow('cannot be moved back')
    expect(store.settings.offsetMs).toBe(5000)

    await service.update(next({ offsetMs: 0 }), { isResetOfOffset: true })
    expect(store.settings.offsetMs).toBe(0)
  })

  it('knows its defaults', () => {
    expect(setup().service.defaults()).toBe(DEFAULT_GAME_TIME_SETTINGS)
  })
})
