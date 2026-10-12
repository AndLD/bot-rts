import { EngineEvent } from './engine-ports'
import { GameEvent } from '../domain/game-event'
import { GameEventDispatcher } from './game-event-dispatcher'

const event: GameEvent = { type: 'EnergyLow', at: 1, parties: [{ userId: 'alice', botId: 'b1' }] }

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const engine = {
    onEvent: (l: (event: EngineEvent) => void) => {
      listener = l
      return off
    }
  }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return { engine, logger, off, emit: (e: EngineEvent) => listener(e) }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('GameEventDispatcher', () => {
  it('hands each game event to every consumer, in turn', async () => {
    const t = setup()
    const order: string[] = []
    const slow = { consume: jest.fn(async () => void (await flush(), order.push('slow'))) }
    const quick = { consume: jest.fn(() => void order.push('quick')) }
    new GameEventDispatcher(t.engine, [slow, quick], t.logger).start()

    t.emit({ type: 'game', userId: 'alice', event })
    await flush()
    await flush()

    expect(slow.consume).toHaveBeenCalledWith('alice', event)
    expect(quick.consume).toHaveBeenCalledWith('alice', event)
    expect(order).toEqual(['slow', 'quick'])
  })

  it('ignores what is not a game event', async () => {
    const t = setup()
    const consumer = { consume: jest.fn() }
    new GameEventDispatcher(t.engine, [consumer], t.logger).start()

    t.emit({ type: 'radio', userId: 'alice', changes: [] })
    await flush()

    expect(consumer.consume).not.toHaveBeenCalled()
  })

  it('logs a consumer that fails and still serves the others', async () => {
    const t = setup()
    const failing = {
      consume: jest.fn(async () => {
        throw new Error('broken consumer')
      })
    }
    const fine = { consume: jest.fn() }
    new GameEventDispatcher(t.engine, [failing, fine], t.logger).start()

    t.emit({ type: 'game', userId: 'alice', event })
    await flush()

    expect(t.logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'broken consumer' }))
    expect(fine.consume).toHaveBeenCalled()
  })

  it('stops listening when stopped, and stopping twice is harmless', () => {
    const t = setup()
    const dispatcher = new GameEventDispatcher(t.engine, [], t.logger)

    dispatcher.start()
    dispatcher.stop()
    dispatcher.stop()

    expect(t.off).toHaveBeenCalledTimes(1)
  })
})
