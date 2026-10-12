import { Module } from '../../modules/domain/module.entity'
import { WorldStateBatch, WorldStateStore } from '../../persistence/application/world-state-store'
import { buildModule } from '../../../tests/integration/builders'
import { WriteBehind } from './write-behind'

const point = (id: string) => ({ id, location: { x: 0, y: 0, z: 0 }, type: null, contentId: null, resource: null })

function setup(every = 10) {
  const batches: WorldStateBatch[] = []
  const store: WorldStateStore = { flush: jest.fn(async (batch: WorldStateBatch) => void batches.push(batch)) }
  return { writeBehind: new WriteBehind(store, every), batches, store }
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

    await writeBehind.flush(10)

    expect(batches[0].modules).toEqual([{ ...module, condition: 40 }])
    expect(batches[0].knownPoints.map((known) => known.seenAt)).toEqual([2])
  })

  it('writes nothing when nothing changed', async () => {
    const { writeBehind, store } = setup()

    await writeBehind.flush(10)

    expect(store.flush).not.toHaveBeenCalled()
  })

  it('keeps a failed batch for the next try, with newer values winning', async () => {
    const { writeBehind, store, batches } = setup()
    const module: Module = buildModule('bot')
    ;(store.flush as jest.Mock).mockRejectedValueOnce(new Error('db down'))
    writeBehind.stageModule(module)
    writeBehind.stageMapPoint(point('p1'))
    writeBehind.stageKnownPoint({ ...point('k'), userId: 'u', seenAt: 1 })

    const failing = writeBehind.flush(10)
    writeBehind.stageModule({ ...module, condition: 7 })
    await expect(failing).rejects.toThrow('db down')

    await writeBehind.flush(20)
    expect(batches[0].modules).toEqual([{ ...module, condition: 7 }])
    expect(batches[0].mapPoints).toHaveLength(1)
    expect(batches[0].knownPoints).toHaveLength(1)
  })
})
