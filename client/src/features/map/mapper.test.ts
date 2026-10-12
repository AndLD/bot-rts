import { IMapCell, MapPointType } from '@lib/utils/interfaces/map'
import { RESOURCE } from '@lib/utils/interfaces/resources'
import { isLiveAt, toMapCell } from './mapper'

const base: IMapCell = { x: 3, y: 4, type: null, contentId: null, seenAt: 100 }
const area = { scannerId: 's', botId: 'b', x: 3, y: 4, radius: 1 }

describe('toMapCell', () => {
  it('turns every kind of cell into what the renderer draws', () => {
    expect(toMapCell(base, []).content).toEqual({ kind: 'empty' })
    expect(
      toMapCell(
        { ...base, type: MapPointType.RESOURCE, resource: { resource: RESOURCE.GOLD, amount: 7 }, capacity: 40 },
        []
      ).content
    ).toEqual({ kind: 'resource', resource: 'gold', amount: 7, capacity: 40 })
    expect(
      toMapCell({ ...base, type: MapPointType.RESOURCE, resource: { resource: RESOURCE.GOLD, amount: 7 } }, []).content
    ).toMatchObject({ capacity: 7 })
    expect(toMapCell({ ...base, type: MapPointType.RESOURCE }, []).content).toEqual({ kind: 'empty' })
    expect(toMapCell({ ...base, type: MapPointType.ITEM, item: 'blueprint' }, []).content).toEqual({
      kind: 'item',
      item: 'blueprint'
    })
    expect(toMapCell({ ...base, type: MapPointType.ITEM }, []).content).toEqual({ kind: 'item', item: 'generic' })
    expect(toMapCell({ ...base, type: MapPointType.BASE, isOwn: true }, []).content).toEqual({
      kind: 'base',
      owner: 'own',
      isCorpse: false
    })
    expect(toMapCell({ ...base, type: MapPointType.CORPSE_BASE }, []).content).toEqual({
      kind: 'base',
      owner: 'enemy',
      isCorpse: true
    })
  })

  it('describes a bot, with defaults for what the server left out', () => {
    expect(toMapCell({ ...base, type: MapPointType.BOT }, []).content).toEqual({
      kind: 'bot',
      owner: 'enemy',
      chassis: 'wheels',
      overlays: [],
      isDamaged: false,
      isStale: false
    })
    expect(
      toMapCell(
        { ...base, type: MapPointType.BOT, isOwn: true, chassis: 'tracks', icons: ['drill'], isDamaged: true },
        []
      ).content
    ).toMatchObject({ owner: 'own', chassis: 'tracks', overlays: ['drill'], isDamaged: true })
  })

  it('adds the radio link: bars while connected, the time it was lost otherwise', () => {
    const bot = { ...base, type: MapPointType.BOT, isOwn: true }

    expect(toMapCell(bot, [], { isConnected: true, bars: 3 }).content).toMatchObject({ signal: 3 })
    expect(toMapCell(bot, [], { isConnected: false, bars: 0, lostAt: 50 }).content).toMatchObject({ linkLostAt: 50 })
    expect(toMapCell(bot, [], { isConnected: false, bars: 0 }).content).toMatchObject({ linkLostAt: 0 })
  })

  it('knows which cells a live area covers', () => {
    expect(toMapCell(base, [area]).isLive).toBe(true)
    expect(toMapCell(base, []).isLive).toBe(false)
    expect(isLiveAt([area], 4, 5)).toBe(true)
    expect(isLiveAt([area], 5, 4)).toBe(false)
    expect(toMapCell(base, []).seenAt).toBe(100)
  })
})
