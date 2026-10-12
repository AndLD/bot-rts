import { GameEvent } from '@lib/utils/interfaces/events'
import { IMapCell, MapPointType } from '@lib/utils/interfaces/map'
import { MapStore } from './MapStore'

const bot = (x: number, contentId = 'b1'): IMapCell => ({
  x,
  y: 0,
  type: MapPointType.BOT,
  contentId,
  seenAt: 5,
  isOwn: true
})
const area = { scannerId: 's', botId: 'b1', x: 0, y: 0, radius: 1 }

describe('MapStore', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(10_000))
  afterEach(() => jest.restoreAllMocks())

  it('shows loaded cells and tells its listeners', () => {
    const store = new MapStore()
    const listener = jest.fn()
    const off = store.subscribe(listener)

    store.load({ now: 20_000, cells: [bot(0)], liveAreas: [area] })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getCell(0, 0)?.isLive).toBe(true)
    expect(store.getCells().size).toBe(1)
    expect(store.getLiveAreas()).toEqual([area])
    expect(store.getCell(9, 9)).toBeUndefined()

    off()
    store.apply({ now: 20_000, cells: [bot(5)] })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("counts time in the server's clock", () => {
    const store = new MapStore()
    store.apply({ now: 25_000, cells: [] })

    expect(store.now()).toBe(25_000)
  })

  it('applies changes over what is there', () => {
    const store = new MapStore()
    store.load({ now: 1, cells: [bot(0), bot(1, 'b2')], liveAreas: [] })
    store.apply({ now: 2, cells: [{ x: 0, y: 0, type: null, contentId: null, seenAt: 9 }] })

    expect(store.getCell(0, 0)?.content).toEqual({ kind: 'empty' })
    expect(store.getCell(1, 0)?.content.kind).toBe('bot')
  })

  it('moves the live status when the areas move', () => {
    const store = new MapStore()
    store.load({ now: 1, cells: [bot(0)], liveAreas: [] })
    expect(store.getCell(0, 0)?.isLive).toBe(false)

    store.setLiveAreas([area])
    expect(store.getCell(0, 0)?.isLive).toBe(true)

    store.setLiveAreas([])
    expect(store.getCell(0, 0)?.isLive).toBe(false)
  })

  it('shows the signal of a bot from the radio, and when the link was lost', () => {
    const store = new MapStore()
    store.load({ now: 10_000, cells: [bot(0), bot(1, 'b2'), { ...bot(2), contentId: null }], liveAreas: [] })

    store.setRadio([{ botId: 'b1', isConnected: true, bars: 2, hops: 1 }])
    expect(store.getCell(0, 0)?.content).toMatchObject({ signal: 2 })
    expect(store.getCell(1, 0)?.content).not.toHaveProperty('signal')

    jest.spyOn(Date, 'now').mockReturnValue(12_000)
    store.setRadio([{ botId: 'b1', isConnected: false, bars: 0, hops: 0 }])
    expect(store.getCell(0, 0)?.content).toMatchObject({ linkLostAt: 12_000 })

    // The moment the link was lost is kept while it stays lost
    jest.spyOn(Date, 'now').mockReturnValue(14_000)
    store.setRadio([{ botId: 'b1', isConnected: false, bars: 0, hops: 0 }])
    expect(store.getCell(0, 0)?.content).toMatchObject({ linkLostAt: 12_000 })

    store.setRadio([{ botId: 'b1', isConnected: true, bars: 4, hops: 1 }])
    expect(store.getCell(0, 0)?.content).toMatchObject({ signal: 4 })
  })

  it('remembers the radio of a bot it does not show yet', () => {
    const store = new MapStore()
    store.setRadio([{ botId: 'b9', isConnected: true, bars: 1, hops: 1 }])
    store.apply({ now: 1, cells: [bot(0, 'b9')] })

    expect(store.getCell(0, 0)?.content).toMatchObject({ signal: 1 })
  })

  it('clears', () => {
    const store = new MapStore()
    store.apply({ now: 1, cells: [bot(0)] })
    store.clear()

    expect(store.getCells().size).toBe(0)
  })

  it('hands the game events to those who listen, until they stop', () => {
    const store = new MapStore()
    const listener = jest.fn()
    const off = store.subscribeEvents(listener)
    const event: GameEvent = { type: 'EnergyLow', at: 1, parties: [{ userId: 'u', botId: 'b1' }] }

    store.publishEvent(event)
    off()
    store.publishEvent(event)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(event)
  })

  it('finds where a bot is', () => {
    const store = new MapStore()
    store.apply({ now: 1, cells: [bot(3, 'b7')] })

    expect(store.locate('b7')).toEqual({ x: 3, y: 0 })
    expect(store.locate('nobody')).toBeNull()
  })
})
