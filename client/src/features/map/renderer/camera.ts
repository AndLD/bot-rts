import { Camera, CellRange, Size } from './model'

export const TILE_SIZE = 32
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
// Below this zoom the renderer draws plain colours instead of sprites (level of detail)
export const LOD_ZOOM = 0.5

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

// Screen pixels that one cell takes
export const cellPixels = (camera: Camera) => TILE_SIZE * camera.zoom

export function worldToScreen(camera: Camera, size: Size, x: number, y: number) {
  const scale = cellPixels(camera)

  return { x: (x - camera.centerX) * scale + size.width / 2, y: (y - camera.centerY) * scale + size.height / 2 }
}

// The cell under a screen point (cells are unit squares whose top-left corner is the integer coordinate)
export function screenToCell(camera: Camera, size: Size, px: number, py: number) {
  const scale = cellPixels(camera)

  return {
    x: Math.floor((px - size.width / 2) / scale + camera.centerX),
    y: Math.floor((py - size.height / 2) / scale + camera.centerY)
  }
}

export function panBy(camera: Camera, dxPixels: number, dyPixels: number): Camera {
  const scale = cellPixels(camera)

  return { ...camera, centerX: camera.centerX - dxPixels / scale, centerY: camera.centerY - dyPixels / scale }
}

// Zooms so that the world point under the screen point stays under it
export function zoomAt(camera: Camera, size: Size, px: number, py: number, factor: number): Camera {
  const zoom = clampZoom(camera.zoom * factor)
  const scale = TILE_SIZE * zoom
  const worldX = (px - size.width / 2) / cellPixels(camera) + camera.centerX
  const worldY = (py - size.height / 2) / cellPixels(camera) + camera.centerY

  return { zoom, centerX: worldX - (px - size.width / 2) / scale, centerY: worldY - (py - size.height / 2) / scale }
}

// The cells that are at least partly on screen
export function visibleRange(camera: Camera, size: Size): CellRange {
  const scale = cellPixels(camera)
  const halfWidth = size.width / 2 / scale
  const halfHeight = size.height / 2 / scale

  return {
    minX: Math.floor(camera.centerX - halfWidth),
    minY: Math.floor(camera.centerY - halfHeight),
    maxX: Math.floor(camera.centerX + halfWidth),
    maxY: Math.floor(camera.centerY + halfHeight)
  }
}
