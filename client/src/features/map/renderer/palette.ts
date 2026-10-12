import { RESOURCE } from '@lib/utils/interfaces/resources'
import { CellContent } from './model'

// Fallback palette (design §4.3): used at low zoom and when a sprite is missing
export const PALETTE = {
  fog: '#000000',
  empty: '#2a2a2e',
  item: '#22d3ee',
  ownBot: '#22c55e',
  enemyBot: '#ef4444',
  ownBase: '#3b82f6',
  enemyBase: '#a855f7',
  corpseBase: '#52525b',
  liveOutline: '#7dd3fc',
  link: '#7dd3fc',
  brokenLink: '#f87171',
  selection: '#fde047',
  resources: {
    [RESOURCE.GOLD]: '#facc15',
    [RESOURCE.IRON]: '#94a3b8',
    [RESOURCE.STONE]: '#78716c',
    [RESOURCE.WOOD]: '#a16207',
    [RESOURCE.OIL]: '#1e1b4b',
    [RESOURCE.CRYSTAL]: '#e879f9'
  } satisfies Record<RESOURCE, string>,
  // Signal bars from none to full
  signal: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
} as const

export function colorOf(content: CellContent): string {
  switch (content.kind) {
    case 'empty':
      return PALETTE.empty
    case 'resource':
      return PALETTE.resources[content.resource]
    case 'item':
      return PALETTE.item
    case 'bot':
      return content.owner === 'own' ? PALETTE.ownBot : PALETTE.enemyBot
    case 'base':
      if (content.isCorpse) {
        return PALETTE.corpseBase
      }
      return content.owner === 'own' ? PALETTE.ownBase : PALETTE.enemyBase
  }
}

// The tint that ownership puts over a bot or base sprite
export function tintOf(content: CellContent): string | null {
  if (content.kind === 'bot') {
    return content.owner === 'own' ? PALETTE.ownBot : PALETTE.enemyBot
  }
  if (content.kind === 'base' && !content.isCorpse) {
    return content.owner === 'own' ? PALETTE.ownBase : PALETTE.enemyBase
  }

  return null
}
