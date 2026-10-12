import { RESOURCE } from '@lib/utils/interfaces/resources'
import {
  cellPixels,
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToCell,
  visibleRange,
  worldToScreen,
  zoomAt
} from './camera'

const size = { width: 640, height: 480 }
const camera = { centerX: 10, centerY: -5, zoom: 1 }

describe('camera', () => {
  it('clamps the zoom', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0.001)).toBe(MIN_ZOOM)
    expect(clampZoom(2)).toBe(2)
  })

  it('maps the world to the screen and back', () => {
    expect(cellPixels({ ...camera, zoom: 2 })).toBe(64)
    expect(worldToScreen(camera, size, 10, -5)).toEqual({ x: 320, y: 240 })
    expect(worldToScreen(camera, size, 11, -4)).toEqual({ x: 352, y: 272 })
    expect(screenToCell(camera, size, 321, 241)).toEqual({ x: 10, y: -5 })
    expect(screenToCell(camera, size, 319, 239)).toEqual({ x: 9, y: -6 })
  })

  it('pans against the drag', () => {
    expect(panBy(camera, 64, -32)).toEqual({ centerX: 8, centerY: -4, zoom: 1 })
  })

  it('keeps the point under the cursor when zooming', () => {
    const zoomed = zoomAt(camera, size, 100, 80, 2)

    expect(zoomed.zoom).toBe(2)
    const before = screenToCell(camera, size, 100, 80)
    const after = screenToCell(zoomed, size, 100, 80)
    expect(after).toEqual(before)
  })

  it('does not zoom past the limits', () => {
    expect(zoomAt(camera, size, 0, 0, 1000).zoom).toBe(MAX_ZOOM)
  })

  it('lists the cells on screen, negative ones included', () => {
    expect(visibleRange({ centerX: 0, centerY: 0, zoom: 1 }, { width: 64, height: 64 })).toEqual({
      minX: -1,
      minY: -1,
      maxX: 1,
      maxY: 1
    })
    expect(RESOURCE.GOLD).toBe('gold')
  })
})
