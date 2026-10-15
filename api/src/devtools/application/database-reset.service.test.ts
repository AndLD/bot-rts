import { DEFAULT_GAME_TIME_SETTINGS } from '../../../../lib/utils/game-time'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { DatabaseResetService } from './database-reset.service'

function setup(options: { engine?: boolean; isEngineEnabled?: boolean } = {}) {
  const order: string[] = []
  const resetter = {
    wipe: jest.fn(async () => {
      order.push('wipe')
      return { tablesEmptied: 20, accountsErased: 4 }
    })
  }
  const engine =
    options.engine === false
      ? null
      : {
          stop: jest.fn(async () => void order.push('stop')),
          start: jest.fn(async () => void order.push('start'))
        }
  const gameTime = { update: jest.fn(async () => void order.push('clock')) }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const service = new DatabaseResetService(resetter, engine, options.isEngineEnabled ?? true, gameTime as never, logger)

  return { service, resetter, engine, gameTime, logger, order }
}

const keep = { actorId: 'a1', sessionId: 's1' }

describe('DatabaseResetService', () => {
  it('stops the engine, empties the tables, starts the engine, and puts the clock back, in that order', async () => {
    const { service, resetter, gameTime, order, logger } = setup()

    const result = await service.reset(keep, 'RESET')

    expect(result).toEqual({ tablesEmptied: 20, accountsErased: 4 })
    expect(order).toEqual(['stop', 'wipe', 'start', 'clock'])
    expect(resetter.wipe).toHaveBeenCalledWith(keep)
    expect(gameTime.update).toHaveBeenCalledWith(DEFAULT_GAME_TIME_SETTINGS, { isResetOfOffset: true })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('20 tables'))
  })

  it('needs the typed word, exactly, and touches nothing without it', async () => {
    const { service, resetter, engine } = setup()

    await expect(service.reset(keep, 'reset')).rejects.toThrow(ValidationError)
    await expect(service.reset(keep, '')).rejects.toThrow('RESET')
    expect(resetter.wipe).not.toHaveBeenCalled()
    expect(engine?.stop).not.toHaveBeenCalled()
  })

  it('starts the engine again even when the wipe fails, and does not touch the clock then', async () => {
    const { service, resetter, engine, gameTime } = setup()
    resetter.wipe.mockRejectedValueOnce(new Error('the database is down'))

    await expect(service.reset(keep, 'RESET')).rejects.toThrow('the database is down')

    expect(engine?.start).toHaveBeenCalledTimes(1)
    expect(gameTime.update).not.toHaveBeenCalled()
  })

  it('refuses when the engine runs on another node, which a reset cannot stop', async () => {
    const { service, resetter } = setup({ engine: false })

    await expect(service.reset(keep, 'RESET')).rejects.toThrow(ForbiddenError)
    expect(resetter.wipe).not.toHaveBeenCalled()
  })

  it('works without an engine when none is switched on', async () => {
    const { service, order } = setup({ engine: false, isEngineEnabled: false })

    await service.reset(keep, 'RESET')

    expect(order).toEqual(['wipe', 'clock'])
  })
})
