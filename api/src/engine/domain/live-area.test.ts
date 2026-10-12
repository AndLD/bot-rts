import { areaCells, areaChunks, areaContains } from './live-area'

const area = { center: { x: 5, y: 5, z: 0 }, radius: 1 }

describe('live area', () => {
  it('contains the square around its center, on its own level only', () => {
    expect(areaContains(area, { x: 4, y: 6, z: 0 })).toBe(true)
    expect(areaContains(area, { x: 6, y: 4, z: 0 })).toBe(true)
    expect(areaContains(area, { x: 7, y: 5, z: 0 })).toBe(false)
    expect(areaContains(area, { x: 5, y: 3, z: 0 })).toBe(false)
    expect(areaContains(area, { x: 5, y: 5, z: 1 })).toBe(false)
  })

  it('lists its cells x-major', () => {
    const cells = areaCells(area)

    expect(cells).toHaveLength(9)
    expect(cells[0]).toEqual({ x: 4, y: 4, z: 0 })
    expect(cells[8]).toEqual({ x: 6, y: 6, z: 0 })
    expect(areaCells({ center: area.center, radius: 0 })).toEqual([{ x: 5, y: 5, z: 0 }])
  })

  it('names the chunks it touches, negative ones included', () => {
    expect(areaChunks(area, 16)).toEqual(['0:0:0'])
    expect(areaChunks({ center: { x: 15, y: 0, z: 0 }, radius: 1 }, 16)).toEqual(['0:-1:0', '0:0:0', '1:-1:0', '1:0:0'])
  })
})
