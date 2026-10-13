import { AnimationSystem } from '../map/animation/AnimationSystem'
import { MapRenderer } from '../map/renderer/MapRenderer'
import { AmbientScene, STEP_INTERVAL_MS, STILL_STEP } from './AmbientScene'
import { sceneFrame } from './script'

function setup() {
  const renderer = {
    resize: jest.fn(),
    setCamera: jest.fn(),
    setCells: jest.fn(),
    requestRender: jest.fn()
  }
  const animations = { handle: jest.fn(), play: jest.fn(), clear: jest.fn() }
  let callback: () => void = () => undefined
  const timers = {
    setInterval: jest.fn((fn: () => void) => {
      callback = fn
      return 7
    }),
    clearInterval: jest.fn()
  }
  const scene = new AmbientScene(renderer as unknown as MapRenderer, animations as unknown as AnimationSystem, timers)

  return { scene, renderer, animations, timers, tick: () => callback() }
}

describe('AmbientScene', () => {
  it('covers the canvas with the scene', () => {
    const { scene, renderer } = setup()

    scene.fit(1000, 400, 2)

    expect(renderer.resize).toHaveBeenCalledWith(1000, 400, 2)
    expect(renderer.setCamera).toHaveBeenCalledWith({ centerX: 10, centerY: 6, zoom: 1000 / (20 * 32) })
    scene.fit(400, 1000, 1)
    expect(renderer.setCamera).toHaveBeenLastCalledWith({ centerX: 10, centerY: 6, zoom: 1000 / (12 * 32) })
  })

  it('plays one step per interval, feeding the events to the animations', () => {
    const { scene, renderer, animations, timers, tick } = setup()

    scene.start()
    scene.start()
    expect(timers.setInterval).toHaveBeenCalledTimes(1)
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), STEP_INTERVAL_MS)
    expect(scene.isRunning).toBe(true)

    for (let step = 0; step < 24; step++) {
      tick()
    }

    expect(renderer.setCells).toHaveBeenCalledTimes(24)
    expect(animations.handle).toHaveBeenCalled()
    expect(animations.play).toHaveBeenCalled()
    expect(renderer.setCells).toHaveBeenNthCalledWith(1, sceneFrame(0).cells)
  })

  it('pauses and resumes', () => {
    const { scene, timers } = setup()

    scene.pause()
    expect(timers.clearInterval).not.toHaveBeenCalled()
    scene.start()
    scene.pause()

    expect(timers.clearInterval).toHaveBeenCalledWith(7)
    expect(scene.isRunning).toBe(false)
  })

  it('shows one still picture without timers', () => {
    const { scene, renderer, animations, timers } = setup()

    scene.start()
    scene.showStill()

    expect(timers.clearInterval).toHaveBeenCalled()
    expect(animations.clear).toHaveBeenCalled()
    expect(renderer.setCells).toHaveBeenCalledWith(sceneFrame(STILL_STEP).cells)
  })
})
