import { Module } from '../../modules/domain/module.entity'
import { WorldStateBatch, WorldStateStore } from '../../persistence/application/world-state-store'
import { buildItem, buildModule } from '../../../tests/integration/builders'
import { EngineMetrics } from './engine-metrics'
import { WriteBehind } from './write-behind'

const point = (id: string) => ({ id, location: { x: 0, y: 0, z: 0 }, type: null, contentId: null, resource: null })

function setup(every = 10) {
  const batches: WorldStateBatch[] = []
  const store: WorldStateStore = { flush: jest.fn(async (batch: WorldStateBatch) => void batches.push(batch)) }
  return { writeBehind: new WriteBehind(store, every, 3), batches, store }
}

describe('WriteBehind', () => {
  it('flushes everything staged once the interval has passed, and not before', async () => {
    const { writeBehind, batches } = setup(10)
    writeBehind.stageMapPoint(point('p1'))

    await expect(writeBehind.flushIfDue(9)).resolves.toBe(false)
    expect(batches).toHaveLength(0)
    await expect(writeBehind.flushIfDue(10)).resolves.toBe(true)
    expect(batches).toHaveLength(1)
    expect(writeBehind.pending).toBe(0)
    await expect(writeBehind.flushIfDue(15)).resolves.toBe(false)
  })

  it('keeps only the newest value of an entity', async () => {
    const { writeBehind, batches } = setup()
    const module = buildModule('bot')
    writeBehind.stageModule(module)
    writeBehind.stageModule({ ...module, condition: 40 })
    writeBehind.stageKnownPoint({ ...point('k'), userId: 'u', seenAt: 1 })
    writeBehind.stageKnownPoint({ ...point('k'), userId: 'u', seenAt: 2 })
    writeBehind.stageItem(buildItem({ id: 'i', botId: null }))
    writeBehind.stageItem(buildItem({ id: 'i', botId: 'b' }))
    writeBehind.stageHeading('b', 1)
    writeBehind.stageHeading('b', 3)

    await writeBehind.flush(10)

    expect(batches[0].modules).toEqual([{ ...module, condition: 40 }])
    expect(batches[0].knownPoints.map((known) => known.seenAt)).toEqual([2])
    expect(batches[0].items.map((item) => item.botId)).toEqual(['b'])
    expect(batches[0].headings).toEqual([{ botId: 'b', heading: 3 }])
  })

  it('writes nothing when nothing changed', async () => {
    const { writeBehind, store } = setup()

    await writeBehind.flush(10)

    expect(store.flush).not.toHaveBeenCalled()
  })

  it('gives a batch up when it keeps failing, and tells the listeners that the memory is not to be trusted', async () => {
    const { writeBehind, store, batches } = setup()
    const discarded = jest.fn()
    writeBehind.onDiscard(discarded)
    ;(store.flush as jest.Mock).mockRejectedValue(new Error('bot deleted'))
    writeBehind.stageMapPoint(point('p1'))

    await expect(writeBehind.flush(10)).rejects.toThrow('bot deleted')
    await expect(writeBehind.flush(20)).rejects.toThrow('bot deleted')
    expect(discarded).not.toHaveBeenCalled()
    expect(writeBehind.pending).toBe(1)
    await expect(writeBehind.flush(30)).rejects.toThrow('bot deleted')

    expect(discarded).toHaveBeenCalledTimes(1)
    expect(writeBehind.pending).toBe(0)
    ;(store.flush as jest.Mock).mockResolvedValue(undefined)
    writeBehind.stageMapPoint(point('p2'))
    await writeBehind.flush(40)
    expect(batches).toHaveLength(0)
    expect(store.flush).toHaveBeenCalledTimes(4)
  })

  it('counts only failures in a row', async () => {
    const { writeBehind, store } = setup()
    const discarded = jest.fn()
    writeBehind.onDiscard(discarded)
    const flush = store.flush as jest.Mock
    for (const outcome of ['fail', 'fail', 'ok', 'fail', 'fail', 'ok']) {
      writeBehind.stageMapPoint(point('p'))
      flush.mockImplementationOnce(async () => {
        if (outcome === 'fail') throw new Error('x')
      })
      await writeBehind.flush(10).catch(() => undefined)
    }

    expect(discarded).not.toHaveBeenCalled()
  })

  it('keeps a failed batch for the next try, with newer values winning', async () => {
    const { writeBehind, store, batches } = setup()
    const module: Module = buildModule('bot')
    ;(store.flush as jest.Mock).mockRejectedValueOnce(new Error('db down'))
    writeBehind.stageModule(module)
    writeBehind.stageMapPoint(point('p1'))
    writeBehind.stageKnownPoint({ ...point('k'), userId: 'u', seenAt: 1 })
    writeBehind.stageItem(buildItem({ id: 'i' }))
    writeBehind.stageHeading('b', 2)

    const failing = writeBehind.flush(10)
    writeBehind.stageModule({ ...module, condition: 7 })
    writeBehind.stageHeading('b', 1)
    await expect(failing).rejects.toThrow('db down')

    await writeBehind.flush(20)
    expect(batches[0].modules).toEqual([{ ...module, condition: 7 }])
    expect(batches[0].mapPoints).toHaveLength(1)
    expect(batches[0].knownPoints).toHaveLength(1)
    expect(batches[0].items.map((item) => item.id)).toEqual(['i'])
    expect(batches[0].headings).toEqual([{ botId: 'b', heading: 1 }])
  })
})

describe('WriteBehind metrics', () => {
  it('tells how many rows the last write held and how long it took, and how many ticks the world went without one', async () => {
    const metrics = new EngineMetrics()
    let now = 100
    const store: WorldStateStore = {
      flush: async () => {
        now += 42
      }
    }
    const writeBehind = new WriteBehind(store, 10, 3, undefined, metrics, () => now)
    writeBehind.stageMapPoint(point('p1'))
    writeBehind.stageMapPoint(point('p2'))
    writeBehind.stageHeading('b', 1)

    await writeBehind.flush(10)

    expect(metrics.snapshot().gauges).toEqual({ flushPending: 3, flushMs: 42 })
    expect(writeBehind.ticksSinceFlush(14)).toBe(4)
  })

  it('does not report the duration of a write that failed', async () => {
    const metrics = new EngineMetrics()
    const store: WorldStateStore = { flush: jest.fn().mockRejectedValue(new Error('down')) }
    const writeBehind = new WriteBehind(store, 10, 3, undefined, metrics)
    writeBehind.stageHeading('b', 1)

    await expect(writeBehind.flush(10)).rejects.toThrow('down')

    expect(metrics.snapshot().gauges).toEqual({ flushPending: 1 })
  })
})
