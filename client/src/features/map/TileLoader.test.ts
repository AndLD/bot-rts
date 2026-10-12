import { IMapView } from '@lib/utils/interfaces/map'
import { MapStore } from './MapStore'
import { TILE_SIDE, TileLoader } from './TileLoader'

const view = (): IMapView => ({ now: 1, cells: [], liveAreas: [] })

function setup() {
  const store = new MapStore()
  const load = jest.spyOn(store, 'load')
  const request = jest.fn().mockResolvedValue(view())

  return { loader: new TileLoader(request, store), request, load }
}

describe('TileLoader', () => {
  it('asks for the tiles on screen, once each', async () => {
    const { loader, request, load } = setup()
    const range = { minX: -1, minY: 0, maxX: TILE_SIDE, maxY: 5 }

    await loader.ensure(range)
    await loader.ensure(range)

    expect(request.mock.calls.map(([r]) => [r.minX, r.minY, r.maxX, r.maxY])).toEqual([
      [-TILE_SIDE, 0, -1, TILE_SIDE - 1],
      [0, 0, TILE_SIDE - 1, TILE_SIDE - 1],
      [TILE_SIDE, 0, 2 * TILE_SIDE - 1, TILE_SIDE - 1]
    ])
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('does not ask again for a tile that is on its way', async () => {
    const { loader, request } = setup()
    const range = { minX: 0, minY: 0, maxX: 1, maxY: 1 }

    await Promise.all([loader.ensure(range), loader.ensure(range)])

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('caps the tiles of one call', async () => {
    const { loader, request } = setup()

    await loader.ensure({ minX: 0, minY: 0, maxX: 100 * TILE_SIDE, maxY: 0 })

    expect(request).toHaveBeenCalledTimes(24)
  })

  it('asks again after a failure, and after being invalidated', async () => {
    const { loader, request } = setup()
    const range = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    request.mockRejectedValueOnce(new Error('offline'))

    await loader.ensure(range)
    await loader.ensure(range)
    expect(request).toHaveBeenCalledTimes(2)

    loader.invalidate()
    await loader.ensure(range)
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('drops the answer of a request made before an invalidation', async () => {
    const { loader, request, load } = setup()
    let answer: (v: IMapView) => void = () => undefined
    request.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    const pending = loader.ensure({ minX: 0, minY: 0, maxX: 1, maxY: 1 })

    loader.invalidate()
    answer(view())
    await pending

    expect(load).not.toHaveBeenCalled()
  })

  it('tells listeners about an invalidation until they stop listening', () => {
    const { loader } = setup()
    const listener = jest.fn()
    const off = loader.onInvalidate(listener)

    loader.invalidate()
    off()
    loader.invalidate()

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
