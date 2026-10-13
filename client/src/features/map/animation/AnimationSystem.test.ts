import { GameEvent } from '@lib/utils/interfaces/events'
import { createFakeContext } from '../../../../tests/canvas'
import { AnimationSystem, DEFAULT_MAX_EFFECTS, TWEEN_MS_PER_CELL } from './AnimationSystem'
import { Painter } from './painter'

const at = { x: 4, y: 5, z: 0 }
const party = [{ userId: 'u', botId: 'b1' }] as [{ userId: string; botId: string }]
const base = { at: 1, parties: party }

function setup(
  options: { reduced?: boolean; zoom?: number; max?: number; bot?: { x: number; y: number } | null } = {}
) {
  let now = 1000
  const system = new AnimationSystem({
    now: () => now,
    isReducedMotion: () => options.reduced ?? false,
    locate: jest.fn(() => (options.bot === undefined ? { x: 9, y: 9 } : options.bot)),
    zoom: () => options.zoom ?? 1,
    maxEffects: options.max
  })
  const context = createFakeContext()
  const painter: Painter = { context, cellSize: 32, cellToScreen: (x, y) => ({ x: x * 32, y: y * 32 }) }

  return { system, context, painter, advance: (ms: number) => (now += ms) }
}

const events: Array<[string, GameEvent]> = [
  ['ShotFired', { ...base, type: 'ShotFired', location: at, target: { x: 8, y: 5, z: 0 }, rounds: 1 }],
  ['ShotHit', { ...base, type: 'ShotHit', location: at, hits: 2, victimBotId: 'b2' }],
  ['ResourceMined', { ...base, type: 'ResourceMined', location: at, resource: 'iron', amount: 5 }],
  ['DepositDepleted', { ...base, type: 'DepositDepleted', location: at, resource: 'iron' }],
  ['ScanCompleted', { ...base, type: 'ScanCompleted', location: at, cells: 9 }],
  ['ModuleDamaged', { ...base, type: 'ModuleDamaged', location: at, moduleId: 'm', condition: 3 }],
  ['ModuleBroken', { ...base, type: 'ModuleBroken', location: at, moduleId: 'm' }],
  ['LinkLost', { ...base, type: 'LinkLost', location: at }],
  ['LinkRestored', { ...base, type: 'LinkRestored', location: at, missed: { scans: 0, events: 0, byType: {} } }],
  ['EnergyLow', { ...base, type: 'EnergyLow', location: at }]
]

describe('AnimationSystem', () => {
  it.each(events)('plays something for %s, and it ends', (_name, event) => {
    const { system, painter, advance } = setup()

    system.handle(event)
    expect(system.activeCount).toBe(1)
    expect(system.draw(painter)).toBe(true)

    advance(5000)
    expect(system.draw(painter)).toBe(false)
    expect(system.activeCount).toBe(0)
  })

  it('draws the effect where it happened, and finds a bot by itself when the event names no place', () => {
    const { system, painter, context } = setup({ bot: { x: 7, y: 7 } })

    system.handle({ ...base, type: 'ScanCompleted', cells: 9 })
    system.draw(painter)

    expect(context.called('arc')[0].slice(0, 2)).toEqual([7 * 32 + 16, 7 * 32 + 16])
  })

  it('plays nothing for an event it cannot place, or does not know a look for', () => {
    const { system } = setup({ bot: null })

    system.handle({ ...base, type: 'ScanCompleted', cells: 9 })
    system.handle({ ...base, parties: [{ userId: 'u', botId: null }], type: 'ScanCompleted', cells: 9 })
    system.handle({ ...base, type: 'ExecutionFinished', location: at, executionId: 'e' })

    expect(system.activeCount).toBe(0)
  })

  it('tweens a move from where the bot was to where it is, then stops', () => {
    const { system, advance } = setup()

    system.handle({ ...base, type: 'BotMoved', from: { x: 2, y: 5, z: 0 }, to: { x: 4, y: 5, z: 0 } })

    expect(system.moveOffset(4, 5)).toEqual({ dx: -2, dy: 0 })
    expect(system.moveOffset(0, 0)).toBeNull()
    advance(TWEEN_MS_PER_CELL)
    expect(system.moveOffset(4, 5)?.dx).toBeCloseTo(-1)
    advance(TWEEN_MS_PER_CELL * 2)
    expect(system.moveOffset(4, 5)).toBeNull()
    expect(system.activeCount).toBe(0)
  })

  it('lets a tween that nobody asks about end by itself', () => {
    const { system, painter, advance } = setup()
    system.handle({ ...base, type: 'BotMoved', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 } })

    expect(system.draw(painter)).toBe(true)
    advance(1000)
    expect(system.draw(painter)).toBe(false)
  })

  it('keeps at most the given number of effects, dropping the oldest first', () => {
    const { system } = setup({ max: 3 })

    for (let n = 0; n < 10; n++) {
      system.handle(events[0][1])
    }

    expect(system.activeCount).toBe(3)
    expect(DEFAULT_MAX_EFFECTS).toBeGreaterThan(3)
  })

  it('caps at the default number when none is given', () => {
    const { system } = setup()

    for (let n = 0; n < DEFAULT_MAX_EFFECTS + 20; n++) {
      system.handle(events[0][1])
    }

    expect(system.activeCount).toBe(DEFAULT_MAX_EFFECTS)
  })

  it('shows a still outline instead of motion when motion is reduced, and does not tween', () => {
    const { system, painter, context } = setup({ reduced: true })

    system.handle(events[0][1])
    system.handle({ ...base, type: 'BotMoved', from: { x: 0, y: 0, z: 0 }, to: { x: 3, y: 0, z: 0 } })
    system.draw(painter)

    expect(system.moveOffset(3, 0)).toBeNull()
    expect(context.called('strokeRect')).toHaveLength(2)
    expect(context.called('moveTo')).toHaveLength(0)
  })

  it('plays nothing when zoomed out too far to see it', () => {
    const { system } = setup({ zoom: 0.2 })

    for (const [, event] of events) system.handle(event)
    system.handle({ ...base, type: 'BotMoved', from: at, to: at })

    expect(system.activeCount).toBe(0)
  })

  it('forgets everything when cleared', () => {
    const { system } = setup()
    system.handle(events[0][1])
    system.handle({ ...base, type: 'BotMoved', from: at, to: { x: 5, y: 5, z: 0 } })

    system.clear()

    expect(system.activeCount).toBe(0)
  })
})

describe('AnimationSystem.play', () => {
  it('plays an effect that no event stands for', () => {
    const { system } = setup()

    system.play({ startedAt: 1000, durationMs: 100, draw: jest.fn() })

    expect(system.activeCount).toBe(1)
  })
})
