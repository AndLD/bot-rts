// What an effect draws with: the context and where a cell is on the screen
export interface Painter {
  context: CanvasRenderingContext2D
  // The top-left corner of a cell on the screen
  cellToScreen(x: number, y: number): { x: number; y: number }
  // Screen pixels that one cell takes
  cellSize: number
}

export interface Effect {
  startedAt: number
  durationMs: number
  draw(painter: Painter, progress: number): void
}

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

// A number in [0, 1) from a seed, the same every time: particles look random but do not jump between frames
export function seeded(seed: number, index: number): number {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453

  return value - Math.floor(value)
}
