import { RESOURCE } from '@lib/utils/interfaces/resources'
import { CellContent } from './model'
import { colorOf, PALETTE, tintOf } from './palette'

const bot = (owner: 'own' | 'enemy'): CellContent => ({
  kind: 'bot',
  owner,
  chassis: 'wheels',
  overlays: [],
  isDamaged: false,
  isStale: false
})

describe('palette', () => {
  it('colours every kind of cell', () => {
    expect(colorOf({ kind: 'empty' })).toBe(PALETTE.empty)
    expect(colorOf({ kind: 'resource', resource: RESOURCE.GOLD, amount: 1, capacity: 1 })).toBe(PALETTE.resources.gold)
    expect(colorOf({ kind: 'item', item: 'part' })).toBe(PALETTE.item)
    expect(colorOf(bot('own'))).toBe(PALETTE.ownBot)
    expect(colorOf(bot('enemy'))).toBe(PALETTE.enemyBot)
    expect(colorOf({ kind: 'base', owner: 'own', isCorpse: false })).toBe(PALETTE.ownBase)
    expect(colorOf({ kind: 'base', owner: 'enemy', isCorpse: false })).toBe(PALETTE.enemyBase)
    expect(colorOf({ kind: 'base', owner: 'own', isCorpse: true })).toBe(PALETTE.corpseBase)
  })

  it('tints bots and living bases by owner only', () => {
    expect(tintOf(bot('own'))).toBe(PALETTE.ownBot)
    expect(tintOf(bot('enemy'))).toBe(PALETTE.enemyBot)
    expect(tintOf({ kind: 'base', owner: 'own', isCorpse: false })).toBe(PALETTE.ownBase)
    expect(tintOf({ kind: 'base', owner: 'enemy', isCorpse: false })).toBe(PALETTE.enemyBase)
    expect(tintOf({ kind: 'base', owner: 'own', isCorpse: true })).toBeNull()
    expect(tintOf({ kind: 'empty' })).toBeNull()
  })
})
