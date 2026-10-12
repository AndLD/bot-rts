import { ahead, isNeighbour, turned } from './heading'

describe('heading', () => {
  it('goes ahead north (smaller y), east, south and west', () => {
    const from = { x: 5, y: 5, z: 0 }
    expect([0, 1, 2, 3].map((h) => ahead(from, h as 0 | 1 | 2 | 3))).toEqual([
      { x: 5, y: 4, z: 0 },
      { x: 6, y: 5, z: 0 },
      { x: 5, y: 6, z: 0 },
      { x: 4, y: 5, z: 0 }
    ])
    expect(ahead({ x: 0, y: 0 }, 1, 3)).toEqual({ x: 3, y: 0, z: 0 })
  })

  it('turns a quarter left or right and wraps around', () => {
    expect(turned(0, 'right')).toBe(1)
    expect(turned(3, 'right')).toBe(0)
    expect(turned(0, 'left')).toBe(3)
    expect(turned(2, 'left')).toBe(1)
  })

  it('knows neighbours, diagonals included, and not the cell itself or another level', () => {
    const cell = { x: 2, y: 2, z: 0 }
    expect(isNeighbour(cell, { x: 3, y: 3, z: 0 })).toBe(true)
    expect(isNeighbour(cell, { x: 2, y: 1, z: 0 })).toBe(true)
    expect(isNeighbour(cell, cell)).toBe(false)
    expect(isNeighbour(cell, { x: 4, y: 2, z: 0 })).toBe(false)
    expect(isNeighbour(cell, { x: 3, y: 2, z: 1 })).toBe(false)
    expect(isNeighbour({ x: 2, y: 2 }, { x: 3, y: 2, z: 0 })).toBe(true)
  })
})
