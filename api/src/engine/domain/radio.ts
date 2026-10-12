import { Location } from '../../map/domain/map-point.entity'

// The radio network (design §11.2.1). These are the pure rules; the engine keeps the state.

// 0 means no signal; a connected bot always has at least 1 bar
export type Bars = 0 | 1 | 2 | 3 | 4

export interface RadioBalance {
  // The margins (1 − distance / range) from which a link shows 4, 3 and 2 bars; any other link in range shows 1
  barMargins: readonly [number, number, number]
}

export const DEFAULT_RADIO_BALANCE: RadioBalance = { barMargins: [0.75, 0.5, 0.25] }

// A bot that can take part: its adapter works and it has energy (an empty battery switches the adapter off)
export interface RadioNode {
  readonly botId: string
  readonly position: Location
  // Range of the adapter in cells
  readonly range: number
}

export interface BotLink {
  readonly isConnected: boolean
  readonly bars: Bars
  // Links on the path from the base
  readonly hops: number
  // The weakest link on the path, as the bot at its far end and its margin
  readonly weakest?: { readonly botId: string; readonly margin: number }
}

export const NOT_CONNECTED: BotLink = { isConnected: false, bars: 0, hops: 0 }

// Cells between two positions, the square (Chebyshev) metric of design §11.2.1
export function distanceBetween(a: Location, b: Location): number {
  return a.z === b.z ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity
}

// The margin of the link between two nodes, or null when they are out of reach of each other: the link holds at the smaller of
// the two ranges
export function linkMargin(a: RadioNode, b: RadioNode): number | null {
  const range = Math.min(a.range, b.range)
  const distance = distanceBetween(a.position, b.position)
  return range > 0 && distance <= range ? 1 - distance / range : null
}

export function barsFor(margin: number, balance: RadioBalance = DEFAULT_RADIO_BALANCE): Bars {
  const [four, three, two] = balance.barMargins
  if (margin >= four) return 4
  if (margin >= three) return 3
  if (margin >= two) return 2
  return 1
}

// Which nodes the base reaches through chains of links, and how well. A node's signal is that of the weakest link on its path;
// of several paths the one whose weakest link is strongest wins, then the one with fewer hops (so the indicator never shows
// worse than the player could have).
export function connectivity(
  rootId: string,
  nodes: readonly RadioNode[],
  balance: RadioBalance = DEFAULT_RADIO_BALANCE
): Map<string, BotLink> {
  const byId = new Map(nodes.map((node) => [node.botId, node]))
  const root = byId.get(rootId)
  const reached = new Map<string, BotLink>()
  if (!root) {
    return reached
  }
  reached.set(rootId, { isConnected: true, bars: 4, hops: 0 })
  const margins = new Map<string, number>([[rootId, Infinity]])
  const open = new Set([rootId])

  while (open.size) {
    // Settle the open node with the best weakest link first (a widest-path search)
    const current = [...open].sort(
      (a, b) =>
        (margins.get(b) as number) - (margins.get(a) as number) ||
        (reached.get(a) as BotLink).hops - (reached.get(b) as BotLink).hops ||
        a.localeCompare(b)
    )[0]
    open.delete(current)
    const from = byId.get(current) as RadioNode
    const here = reached.get(current) as BotLink

    for (const to of nodes) {
      const margin = to.botId === current ? null : linkMargin(from, to)
      if (margin === null) {
        continue
      }
      const weakest = Math.min(margins.get(current) as number, margin)
      const known = reached.get(to.botId)
      const knownWeakest = margins.get(to.botId)
      const better =
        !known || weakest > (knownWeakest as number) || (weakest === knownWeakest && here.hops + 1 < known.hops)
      if (better && to.botId !== rootId) {
        margins.set(to.botId, weakest)
        reached.set(to.botId, {
          isConnected: true,
          bars: barsFor(weakest, balance),
          hops: here.hops + 1,
          weakest: weakest === margin ? { botId: to.botId, margin } : here.weakest
        })
        open.add(to.botId)
      }
    }
  }
  return reached
}
