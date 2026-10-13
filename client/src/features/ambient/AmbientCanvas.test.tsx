import { render, screen } from '@testing-library/react'
import AmbientCanvas from './AmbientCanvas'

const renderer = { dispose: jest.fn(), getCamera: jest.fn(() => ({ zoom: 1 })), setAtlas: jest.fn() }
const scene = { fit: jest.fn(), start: jest.fn(), pause: jest.fn(), showStill: jest.fn() }
let options: { isReducedMotion(): boolean; zoom(): number; locate(): null; now(): number }
let timers: { setInterval(cb: () => void, ms: number): number; clearInterval(handle: number): void }
jest.mock('../map/renderer/MapRenderer', () => ({ MapRenderer: jest.fn(() => renderer) }))
jest.mock('../map/animation/AnimationSystem', () => ({
  AnimationSystem: jest.fn((given: typeof options) => {
    options = given
    return {}
  })
}))
jest.mock('./AmbientScene', () => ({
  AmbientScene: jest.fn((_r: unknown, _a: unknown, given: typeof timers) => {
    timers = given
    return scene
  })
}))
const loadAtlas = jest.fn()
jest.mock('../map/renderer/atlas', () => ({ loadAtlas: (...args: unknown[]) => loadAtlas(...args) }))

class FakeResizeObserver {
  static callback: () => void = () => undefined
  constructor(callback: () => void) {
    FakeResizeObserver.callback = callback
  }
  observe() {}
  disconnect() {}
}

function mockMotion(isReduced: boolean) {
  window.matchMedia = jest.fn(() => ({
    matches: isReduced,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  })) as never
}

function setHidden(isHidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: isHidden })
}

describe('AmbientCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.ResizeObserver = FakeResizeObserver as never
    loadAtlas.mockResolvedValue({ name: 'atlas' })
    mockMotion(false)
    setHidden(false)
  })

  it('plays the scene, fits it to the canvas and gives the renderer the atlas', async () => {
    render(<AmbientCanvas />)

    expect(screen.getByTestId('ambient-scene')).toHaveAttribute('aria-hidden', 'true')
    expect(scene.start).toHaveBeenCalled()
    expect(scene.fit).toHaveBeenCalled()
    await Promise.resolve()
    expect(renderer.setAtlas).toHaveBeenCalledWith({ name: 'atlas' })
    expect(options.isReducedMotion()).toBe(false)
    expect(options.zoom()).toBe(1)
    expect(options.locate()).toBeNull()
    expect(options.now()).toEqual(expect.any(Number))

    FakeResizeObserver.callback()
    expect(scene.fit).toHaveBeenCalledTimes(2)
    jest.useFakeTimers()
    const handle = timers.setInterval(jest.fn(), 10)
    timers.clearInterval(handle)
    jest.useRealTimers()
  })

  it('pauses while the tab is hidden and resumes when it is shown', () => {
    render(<AmbientCanvas />)

    setHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(scene.pause).toHaveBeenCalled()

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(scene.start).toHaveBeenCalledTimes(2)
  })

  it('shows one still picture under reduced motion', () => {
    mockMotion(true)

    render(<AmbientCanvas />)

    expect(scene.showStill).toHaveBeenCalled()
    expect(scene.start).not.toHaveBeenCalled()
  })

  it('stops everything when it goes away, and ignores an atlas that arrives late', async () => {
    let resolveAtlas: (atlas: unknown) => void = () => undefined
    loadAtlas.mockReturnValue(new Promise((resolve) => (resolveAtlas = resolve)))
    const { unmount } = render(<AmbientCanvas />)

    unmount()
    resolveAtlas({})
    await Promise.resolve()

    expect(scene.pause).toHaveBeenCalled()
    expect(renderer.dispose).toHaveBeenCalled()
    expect(renderer.setAtlas).not.toHaveBeenCalled()
  })
})
