import { ageSeconds } from './renderer/aging'
import { MapCell } from './renderer/model'

// What the inspector says about a cell, as a message key with its values (the component translates it)
export interface CellDescription {
  title: { key: string; values?: Record<string, string | number> }
  details: Array<{ key: string; values?: Record<string, string | number> }>
}

export function describeCell(cell: MapCell | undefined, now: number): CellDescription {
  if (!cell) {
    return { title: { key: 'unknown' }, details: [] }
  }

  const { content } = cell
  const details: CellDescription['details'] = []
  let title: CellDescription['title']

  switch (content.kind) {
    case 'empty':
      title = { key: 'empty' }
      break
    case 'resource':
      title = { key: `resources.${content.resource}`, values: { amount: content.amount } }
      details.push({ key: 'deposit', values: { amount: content.amount } })
      break
    case 'item':
      title = { key: `items.${content.item}` }
      break
    case 'bot':
      title = { key: content.owner === 'own' ? 'ownBot' : 'enemyBot' }
      if (content.isDamaged) {
        details.push({ key: 'damaged' })
      }
      if (content.signal !== undefined) {
        details.push({ key: 'signal', values: { bars: content.signal } })
      }
      if (content.linkLostAt !== undefined) {
        details.push({ key: 'linkLost', values: { seconds: ageSeconds(now, content.linkLostAt, 1) } })
      }
      break
    case 'base':
      title = { key: content.isCorpse ? 'corpseBase' : content.owner === 'own' ? 'ownBase' : 'enemyBase' }
      break
  }

  details.push(cell.isLive ? { key: 'live' } : { key: 'seenAgo', values: { seconds: ageSeconds(now, cell.seenAt, 1) } })

  return { title, details }
}
