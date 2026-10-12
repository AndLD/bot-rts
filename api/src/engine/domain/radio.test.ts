import { barsFor, connectivity, DEFAULT_RADIO_BALANCE, distanceBetween, linkMargin, RadioNode } from './radio'

const node = (botId: string, x: number, y = 0, range = 20): RadioNode => ({ botId, position: { x, y, z: 0 }, range })

describe('radio rules', () => {
  it('measures distance in cells, square metric, and never across levels', () => {
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: -7, z: 0 })).toBe(7)
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBe(Infinity)
  })

  it('links two nodes up to the smaller of their ranges', () => {
    expect(linkMargin(node('a', 0, 0, 20), node('b', 10, 0, 40))).toBe(0.5)
    expect(linkMargin(node('a', 0, 0, 20), node('b', 20, 0, 40))).toBe(0)
    expect(linkMargin(node('a', 0, 0, 20), node('b', 21, 0, 40))).toBeNull()
    expect(linkMargin(node('a', 0, 0, 0), node('b', 0, 0, 40))).toBeNull()
    expect(linkMargin(node('a', 5, 5, 20), node('b', 5, 5, 20))).toBe(1)
  })

  it('shows 4 to 1 bars by margin', () => {
    expect([1, 0.75, 0.74, 0.5, 0.25, 0.24, 0].map((margin) => barsFor(margin))).toEqual([4, 4, 3, 3, 2, 1, 1])
    expect(barsFor(0.9, { barMargins: [0.95, 0.9, 0.85] })).toBe(3)
    expect(DEFAULT_RADIO_BALANCE.barMargins).toEqual([0.75, 0.5, 0.25])
  })

  it('connects a chain of relays with the weakest link deciding the signal', () => {
    const nodes = [node('base', 0), node('relay', 10), node('far', 28)]

    const links = connectivity('base', nodes)

    expect(links.get('base')).toEqual({ isConnected: true, bars: 4, hops: 0 })
    expect(links.get('relay')).toMatchObject({
      isConnected: true,
      bars: 3,
      hops: 1,
      weakest: { botId: 'relay', margin: 0.5 }
    })
    // relay -> far is 18 of 20 cells: margin 0.1, one bar, and that is the weakest link of the path
    expect(links.get('far')).toMatchObject({ bars: 1, hops: 2, weakest: { botId: 'far' } })
    expect(links.get('far')?.weakest?.margin).toBeCloseTo(0.1)
  })

  it('leaves a bot out when no chain of links leads to it, or the base itself is not a node', () => {
    const nodes = [node('base', 0), node('lone', 100)]

    expect(connectivity('base', nodes).has('lone')).toBe(false)
    expect(connectivity('nobody', nodes).size).toBe(0)
    expect(connectivity('base', [node('base', 0, 0, 0), node('next', 1)]).has('next')).toBe(false)
  })

  it('prefers the path whose weakest link is strongest, then the shorter one', () => {
    // Direct link at 19 of 20 cells (margin 0.05) or two good hops of 10 cells each
    const nodes = [node('base', 0), node('mid', 10), node('target', 19)]

    const links = connectivity('base', nodes)

    expect(links.get('target')).toMatchObject({ hops: 2, bars: 3 })

    // The same weakest link either way (0.5): the direct link wins by having fewer hops
    const same = connectivity('base', [node('base', 0), node('a', 10), node('target', 10)])
    expect(same.get('target')?.hops).toBe(1)
  })

  it('breaks when a relay is missing', () => {
    const nodes = [node('base', 0), node('far', 28)]

    expect(connectivity('base', nodes).has('far')).toBe(false)
  })

  it('treats two nodes on one cell as linked at full margin', () => {
    const links = connectivity('base', [node('base', 3, 3), node('twin', 3, 3)])

    expect(links.get('twin')).toMatchObject({ bars: 4, hops: 1, weakest: { margin: 1 } })
  })
})
