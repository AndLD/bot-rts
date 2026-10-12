import { RESOURCE } from '@lib/utils/interfaces/resources'
import { describeCell } from './describeCell'
import { CellContent, MapCell } from './renderer/model'

const cell = (content: CellContent, extra: Partial<MapCell> = {}): MapCell => ({
  x: 0,
  y: 0,
  content,
  seenAt: 4_000,
  isLive: false,
  ...extra
})
const bot = (extra = {}): CellContent => ({
  kind: 'bot',
  owner: 'own',
  chassis: 'wheels',
  overlays: [],
  isDamaged: false,
  isStale: false,
  ...extra
})

describe('describeCell', () => {
  it('says a cell never seen is unknown', () => {
    expect(describeCell(undefined, 0)).toEqual({ title: { key: 'unknown' }, details: [] })
  })

  it('describes the contents with the age of the snapshot', () => {
    expect(describeCell(cell({ kind: 'empty' }), 10_000)).toEqual({
      title: { key: 'empty' },
      details: [{ key: 'seenAgo', values: { seconds: 6 } }]
    })
    expect(describeCell(cell({ kind: 'resource', resource: RESOURCE.OIL, amount: 9, capacity: 20 }), 4_000)).toEqual({
      title: { key: 'resources.oil', values: { amount: 9 } },
      details: [
        { key: 'deposit', values: { amount: 9 } },
        { key: 'seenAgo', values: { seconds: 0 } }
      ]
    })
    expect(describeCell(cell({ kind: 'item', item: 'part' }), 4_000).title).toEqual({ key: 'items.part' })
  })

  it('says live cells are live', () => {
    expect(describeCell(cell({ kind: 'empty' }, { isLive: true }), 9).details).toEqual([{ key: 'live' }])
  })

  it('describes bots: ownership, damage, signal and a lost link', () => {
    expect(describeCell(cell(bot({ owner: 'enemy' })), 4_000).title.key).toBe('enemyBot')

    const own = describeCell(cell(bot({ isDamaged: true, signal: 3 })), 4_000)
    expect(own.title.key).toBe('ownBot')
    expect(own.details.map((d) => d.key)).toEqual(['damaged', 'signal', 'seenAgo'])

    expect(describeCell(cell(bot({ linkLostAt: 1_000 })), 4_000).details[0]).toEqual({
      key: 'linkLost',
      values: { seconds: 3 }
    })
  })

  it('names bases', () => {
    const base = (owner: 'own' | 'enemy', isCorpse: boolean) =>
      describeCell(cell({ kind: 'base', owner, isCorpse }), 0).title.key

    expect(base('own', false)).toBe('ownBase')
    expect(base('enemy', false)).toBe('enemyBase')
    expect(base('own', true)).toBe('corpseBase')
  })
})
