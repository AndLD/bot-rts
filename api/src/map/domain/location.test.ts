import { cellsOf, chunkOf, compareLocations, locationKey, splitByChunk } from './location'

describe('chunkOf', () => {
  it('floors towards negative infinity so that negative cells have negative chunks', () => {
    expect(chunkOf({ x: 0, y: 15 }, 16)).toEqual({ cx: 0, cy: 0 })
    expect(chunkOf({ x: 16, y: -1 }, 16)).toEqual({ cx: 1, cy: -1 })
    expect(chunkOf({ x: -16, y: -17 }, 16)).toEqual({ cx: -1, cy: -2 })
  })
})

describe('splitByChunk', () => {
  it('keeps a range inside one chunk whole', () => {
    const range = { from: { x: 1, y: 1, z: 0 }, to: { x: 3, y: 3, z: 0 } }
    expect(splitByChunk(range, 16)).toEqual([range])
  })

  it('cuts a range along the chunk borders', () => {
    const parts = splitByChunk({ from: { x: -1, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 } }, 2)
    expect(parts).toEqual([
      { from: { x: -1, y: 0, z: 0 }, to: { x: -1, y: 0, z: 0 } },
      { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 } }
    ])
  })
})

describe('cellsOf and locationKey', () => {
  it('lists every cell of a range, x-major', () => {
    const cells = [...cellsOf({ from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 0 } })]
    expect(cells.map(locationKey)).toEqual(['0:0:0', '0:1:0', '1:0:0', '1:1:0'])
  })
})

describe('compareLocations', () => {
  it('orders by x, then y, then z', () => {
    const at = (x: number, y: number, z: number) => ({ x, y, z })

    expect(compareLocations(at(0, 5, 5), at(1, 0, 0))).toBeLessThan(0)
    expect(compareLocations(at(1, 0, 5), at(1, 1, 0))).toBeLessThan(0)
    expect(compareLocations(at(1, 1, 1), at(1, 1, 0))).toBeGreaterThan(0)
    expect(compareLocations(at(1, 1, 1), at(1, 1, 1))).toBe(0)
  })
})
