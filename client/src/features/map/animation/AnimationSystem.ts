import { GameEvent } from '@lib/utils/interfaces/events'
import { LOD_ZOOM } from '../renderer/camera'
import { dust, flash, floatingText, highlight, lowEnergy, ring, shot, smoke } from './effects'
import { Effect, Painter } from './painter'

export interface AnimationOptions {
  now: () => number
  // The most effects alive at once: when many events arrive together the oldest go first, so the frame rate holds
  maxEffects?: number
  isReducedMotion: () => boolean
  // Where a bot of the player is, for events that name a bot but not a place
  locate: (botId: string) => { x: number; y: number } | null
  // Zoomed out too far to see an effect (level of detail)
  zoom: () => number
}

interface Tween {
  from: { x: number; y: number }
  to: { x: number; y: number }
  startedAt: number
  durationMs: number
}

export const DEFAULT_MAX_EFFECTS = 64
export const TWEEN_MS_PER_CELL = 160

const tweenKey = (x: number, y: number) => `${x},${y}`

// The animations of the map, driven by game events (design §15.2). They are cosmetic: nothing here changes the world, a missed
// event is only a missed effect. Motion can be reduced to still highlights, and a cap keeps the frame rate when many events come.
export class AnimationSystem {
  private effects: Effect[] = []
  private readonly tweens = new Map<string, Tween>()
  private readonly maxEffects: number

  constructor(private readonly options: AnimationOptions) {
    this.maxEffects = options.maxEffects ?? DEFAULT_MAX_EFFECTS
  }

  get activeCount() {
    return this.effects.length + this.tweens.size
  }

  // Starts what an event looks like. Zoomed far out nothing is started: it could not be seen.
  handle(event: GameEvent) {
    if (this.options.zoom() < LOD_ZOOM) {
      return
    }

    const now = this.options.now()
    const at = event.location ?? this.options.locate(event.parties[0].botId ?? '')

    if (event.type === 'BotMoved' && !this.options.isReducedMotion()) {
      return this.tween(event, now)
    }
    if (!at) {
      return
    }
    if (this.options.isReducedMotion()) {
      return this.add(highlight(now, at, '#fde047'))
    }

    switch (event.type) {
      case 'ShotFired':
        return this.add(shot(now, at, event.target))
      case 'ShotHit':
        return this.add(floatingText(now, at, `-${event.hits}`, '#f87171'))
      case 'ResourceMined':
        return this.add(dust(now, at, event.at))
      case 'DepositDepleted':
        return this.add(ring(now, at, 0.8, '#e4e4e7', 450))
      case 'ScanCompleted':
        return this.add(ring(now, at, Math.max(1, Math.sqrt(event.cells) / 2), '#7dd3fc'))
      case 'ModuleDamaged':
        return this.add(flash(now, at, '#ef4444'))
      case 'ModuleBroken':
        return this.add(smoke(now, at, event.at))
      case 'LinkLost':
        return this.add(ring(now, at, 1.2, '#f87171'))
      case 'LinkRestored':
        return this.add(ring(now, at, 1.2, '#86efac'))
      case 'EnergyLow':
        return this.add(lowEnergy(now, at))
    }
  }

  // Where a moving bot is drawn, as a shift from the cell it ends on, in cells; nothing when it is not moving
  moveOffset(x: number, y: number): { dx: number; dy: number } | null {
    const tween = this.tweens.get(tweenKey(x, y))

    if (!tween) {
      return null
    }
    const progress = (this.options.now() - tween.startedAt) / tween.durationMs

    if (progress >= 1) {
      this.tweens.delete(tweenKey(x, y))
      return null
    }

    return { dx: (tween.from.x - tween.to.x) * (1 - progress), dy: (tween.from.y - tween.to.y) * (1 - progress) }
  }

  // Draws the live effects over the map and forgets the finished ones; true while something is still moving
  draw(painter: Painter): boolean {
    const now = this.options.now()

    this.effects = this.effects.filter((effect) => now - effect.startedAt < effect.durationMs)
    for (const effect of this.effects) {
      effect.draw(painter, (now - effect.startedAt) / effect.durationMs)
    }
    for (const [key, tween] of this.tweens) {
      if (now - tween.startedAt >= tween.durationMs) {
        this.tweens.delete(key)
      }
    }

    return this.activeCount > 0
  }

  // Starts an effect that no game event stands for, such as the scripted repair of the ambient scene
  play(effect: Effect) {
    this.add(effect)
  }

  clear() {
    this.effects = []
    this.tweens.clear()
  }

  private tween(event: Extract<GameEvent, { type: 'BotMoved' }>, now: number) {
    const cells = Math.max(Math.abs(event.to.x - event.from.x), Math.abs(event.to.y - event.from.y))

    this.tweens.set(tweenKey(event.to.x, event.to.y), {
      from: event.from,
      to: event.to,
      startedAt: now,
      durationMs: Math.max(1, cells) * TWEEN_MS_PER_CELL
    })
  }

  private add(effect: Effect) {
    this.effects.push(effect)
    if (this.effects.length > this.maxEffects) {
      this.effects.splice(0, this.effects.length - this.maxEffects)
    }
  }
}
