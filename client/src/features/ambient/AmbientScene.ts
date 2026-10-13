import { AnimationSystem } from '../map/animation/AnimationSystem'
import { ring } from '../map/animation/effects'
import { TILE_SIZE } from '../map/renderer/camera'
import { MapRenderer } from '../map/renderer/MapRenderer'
import { SCENE_COLUMNS, SCENE_ROWS, sceneFrame } from './script'

// The step the still picture (the poster, and the scene under reduced motion) shows: the gunner has just fired and the miner is at work
export const STILL_STEP = 9
export const STEP_INTERVAL_MS = 450

export interface Timers {
  setInterval(callback: () => void, ms: number): number
  clearInterval(handle: number): void
}

// Plays the scripted story of the ambient scene on a map renderer (design §15.3). Framework-free: the owner starts and
// pauses it (for example when the tab is hidden) and says how big the canvas is.
export class AmbientScene {
  private step = 0
  private timer: number | null = null

  constructor(
    private readonly renderer: MapRenderer,
    private readonly animations: AnimationSystem,
    private readonly timers: Timers
  ) {}

  get isRunning() {
    return this.timer !== null
  }

  // Covers the canvas with the scene, whatever its shape
  fit(width: number, height: number, pixelRatio: number) {
    this.renderer.resize(width, height, pixelRatio)
    this.renderer.setCamera({
      centerX: SCENE_COLUMNS / 2,
      centerY: SCENE_ROWS / 2,
      zoom: Math.max(width / (SCENE_COLUMNS * TILE_SIZE), height / (SCENE_ROWS * TILE_SIZE))
    })
  }

  // One motionless picture, with no timers
  showStill() {
    this.pause()
    this.animations.clear()
    this.renderer.setCells(sceneFrame(STILL_STEP).cells)
  }

  start() {
    if (this.timer === null) {
      this.timer = this.timers.setInterval(() => this.advance(), STEP_INTERVAL_MS)
    }
  }

  pause() {
    if (this.timer !== null) {
      this.timers.clearInterval(this.timer)
      this.timer = null
    }
  }

  private advance() {
    const frame = sceneFrame(this.step++)

    this.renderer.setCells(frame.cells)
    for (const event of frame.events) {
      this.animations.handle(event)
    }
    for (const spot of frame.repairs) {
      this.animations.play(ring(performance.now(), spot, 1, '#86efac', 600))
    }
    this.renderer.requestRender()
  }
}
