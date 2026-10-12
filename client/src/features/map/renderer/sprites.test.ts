import { RESOURCE } from '@lib/utils/interfaces/resources'
import { MapCell } from './model'
import { isGhost, layersOf, resourceSprite } from './sprites'

const cell = (content: MapCell['content'], isLive = false): MapCell => ({ x: 0, y: 0, content, seenAt: 0, isLive })

describe('sprites', () => {
  it('shows how much of a deposit is left', () => {
    expect(resourceSprite('gold', 100, 100)).toBe('resource_gold_full')
    expect(resourceSprite('gold', 50, 100)).toBe('resource_gold_half')
    expect(resourceSprite('gold', 10, 100)).toBe('resource_gold_low')
    expect(resourceSprite('gold', 0, 0)).toBe('resource_gold_full')
  })

  it('chooses the layers of every kind of cell', () => {
    expect(layersOf({ kind: 'empty' })).toEqual({ base: 'ground', overlays: [] })
    expect(layersOf({ kind: 'resource', resource: RESOURCE.IRON, amount: 9, capacity: 10 }).base).toBe(
      'resource_iron_full'
    )
    expect(layersOf({ kind: 'item', item: 'blueprint' }).base).toBe('item_blueprint')
    expect(layersOf({ kind: 'base', owner: 'own', isCorpse: false }).base).toBe('base')
    expect(layersOf({ kind: 'base', owner: 'own', isCorpse: true }).base).toBe('base_corpse')
  })

  it('layers module icons and the cracked overlay on a bot', () => {
    const bot = {
      kind: 'bot' as const,
      owner: 'own' as const,
      chassis: 'tracks' as const,
      overlays: ['weapon', 'antenna'] as const,
      isDamaged: true,
      isStale: false
    }

    expect(layersOf(bot)).toEqual({
      base: 'chassis_tracks',
      overlays: ['overlay_weapon', 'overlay_antenna', 'overlay_cracked']
    })
    expect(layersOf({ ...bot, isDamaged: false }).overlays).toEqual(['overlay_weapon', 'overlay_antenna'])
  })

  it('draws remembered bots of others and items as ghosts, but not live or own ones', () => {
    const enemy = {
      kind: 'bot' as const,
      owner: 'enemy' as const,
      chassis: 'wheels' as const,
      overlays: [],
      isDamaged: false,
      isStale: false
    }

    expect(isGhost(cell(enemy))).toBe(true)
    expect(isGhost(cell(enemy, true))).toBe(false)
    expect(isGhost(cell({ ...enemy, owner: 'own' }))).toBe(false)
    expect(isGhost(cell({ kind: 'item', item: 'part' }))).toBe(true)
    expect(isGhost(cell({ kind: 'empty' }))).toBe(false)
  })
})
