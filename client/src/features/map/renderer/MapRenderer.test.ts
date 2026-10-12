import { RESOURCE } from '@lib/utils/interfaces/resources'
import { createFakeCanvas, createFakeContext, FakeContext } from '../../../../tests/canvas'
import { Atlas } from './atlas'
import { MapRenderer } from './MapRenderer'
import { MapCell } from './model'

const frame = { x: 0, y: 0, w: 32, h: 32 }
const atlas: Atlas = {
  image: {} as CanvasImageSource,
  tileSize: 32,
  frame: (name) => (name.includes('unknown') ? undefined : frame)
}

const bot = (overrides: Record<string, unknown> = {}) =>
  ({
    kind: 'bot',
    owner: 'own',
    chassis: 'wheels',
    overlays: ['weapon', 'unknown_overlay'],
    isDamaged: false,
    isStale: false,
    ...overrides
  }) as MapCell['content']

const cell = (x: number, y: number, content: MapCell['content'], extra: Partial<MapCell> = {}): MapCell => ({
  x,
  y,
  content,
  seenAt: 0,
  isLive: false,
  ...extra
})

function setup(options: Partial<ConstructorParameters<typeof MapRenderer>[1]> = {}) {
  const context = createFakeContext()
  const scratchContext = createFakeContext()
  const scheduled: Array<() => void> = []
  const renderer = new MapRenderer(createFakeCanvas(context), {
    schedule: (callback) => scheduled.push(callback),
    cancel: jest.fn(),
    createScratch: () => createFakeCanvas(scratchContext),
    ...options
  })
  renderer.resize(320, 320)
  renderer.setCamera({ centerX: 0.5, centerY: 0.5, zoom: 1 })
  scheduled.splice(0).forEach((frame) => frame())
  context.calls.length = 0

  return { renderer, context, scratchContext, scheduled }
}

const draws = (context: FakeContext) => context.called('drawImage').length

describe('MapRenderer', () => {
  it('needs a 2D canvas', () => {
    expect(() => new MapRenderer(createFakeCanvas(null))).toThrow('Canvas 2D')
  })

  it('sizes the canvas for the pixel ratio', () => {
    const { renderer, context } = setup()
    renderer.resize(100, 50, 2)

    expect(renderer.getSize()).toEqual({ width: 100, height: 50 })
    expect(context.called('setTransform').at(-1)).toEqual([2, 0, 0, 2, 0, 0])
  })

  it('schedules one frame for many changes and cancels it on dispose', () => {
    const cancel = jest.fn()
    const { renderer, scheduled } = setup({ cancel })
    renderer.setNow(5)
    renderer.setSelection(null)
    expect(scheduled).toHaveLength(1)

    scheduled[0]()
    renderer.setNow(6)
    expect(scheduled).toHaveLength(2)

    renderer.dispose()
    renderer.dispose()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('draws fog black and nothing else for an empty map', () => {
    const { renderer, context } = setup()
    renderer.render()

    expect(context.called('fillRect')).toEqual([[0, 0, 320, 320]])
  })

  it('draws colours when there is no atlas, and when the sprite is missing', () => {
    const { renderer, context } = setup()
    renderer.setCells([cell(0, 0, { kind: 'resource', resource: RESOURCE.GOLD, amount: 1, capacity: 1 })])
    renderer.render()
    expect(draws(context)).toBe(0)
    expect(context.called('fillRect')).toHaveLength(2)

    const withAtlas = setup({ atlas: { ...atlas, frame: () => undefined } })
    withAtlas.renderer.setCells([cell(0, 0, { kind: 'empty' })])
    withAtlas.renderer.render()
    expect(draws(withAtlas.context)).toBe(0)
  })

  it('draws sprites from the atlas, once a late atlas arrives', () => {
    const { renderer, context } = setup()
    renderer.setCells([cell(0, 0, { kind: 'empty' })])
    renderer.setAtlas(atlas)
    renderer.render()

    expect(draws(context)).toBe(1)
  })

  it('draws ground under things, a tinted bot with overlays, and a signal', () => {
    const { renderer, context, scratchContext } = setup({ atlas })
    renderer.setCells([cell(0, 0, bot({ signal: 3 }))])
    renderer.render()

    // ground + weapon overlay on the canvas, the tinted chassis through the scratch canvas
    expect(draws(context)).toBe(3)
    expect(draws(scratchContext)).toBe(1)
    expect(context.called('fillRect').length).toBeGreaterThanOrEqual(5)
  })

  it('draws without a tint when the scratch canvas has no context', () => {
    const { renderer, context } = setup({ atlas, createScratch: () => createFakeCanvas(null) })
    renderer.setCells([cell(0, 0, bot())])
    renderer.render()

    expect(draws(context)).toBe(3)
  })

  it('draws untinted sprites for resources, and a cracked, stale, hatched bot', () => {
    const { renderer, context } = setup({ atlas })
    renderer.setCells([
      cell(0, 0, { kind: 'resource', resource: RESOURCE.OIL, amount: 5, capacity: 10 }),
      cell(1, 0, bot({ isDamaged: true, isStale: true, linkLostAt: 3, signal: 2 }))
    ])
    renderer.render()

    expect(context.called('clip')).toHaveLength(1)
    expect(context.called('moveTo').length).toBeGreaterThan(0)
  })

  it('outlines live cells and draws full strength', () => {
    const { renderer, context } = setup()
    renderer.setNow(1000)
    renderer.setCells([cell(0, 0, { kind: 'item', item: 'part' }, { isLive: true })])
    renderer.render()

    expect(context.called('strokeRect')).toHaveLength(1)
  })

  it('draws the last-seen ghost with a dashed border', () => {
    const { renderer, context } = setup()
    renderer.setCells([cell(0, 0, bot({ owner: 'enemy' }))])
    renderer.render()

    expect(context.called('setLineDash')).toContainEqual([[3, 3]])
  })

  it('uses plain colours and no signal bars at low zoom', () => {
    const { renderer, context } = setup({ atlas })
    renderer.setCamera({ centerX: 0.5, centerY: 0.5, zoom: 0.2 })
    renderer.setCells([cell(0, 0, bot({ signal: 4 }))])
    renderer.render()

    expect(draws(context)).toBe(0)
    expect(context.called('fillRect')).toHaveLength(2)
  })

  it('draws links only when asked, and the selection', () => {
    const { renderer, context } = setup()
    renderer.setLinks([
      { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, isBroken: false },
      { from: { x: 0, y: 0 }, to: { x: 0, y: 2 }, isBroken: true }
    ])
    renderer.setSelection({ x: 1, y: 1 })
    renderer.render()
    expect(context.called('lineTo')).toHaveLength(0)
    expect(context.called('strokeRect')).toHaveLength(1)

    renderer.setLinksVisible(true)
    renderer.render()
    expect(context.called('lineTo')).toHaveLength(2)
  })

  it('updates cells, tells the cell under a point and the visible range', () => {
    const { renderer } = setup()
    renderer.setCells([cell(0, 0, { kind: 'empty' })])
    renderer.updateCells([cell(1, 0, { kind: 'empty' })])

    expect(renderer.cellData(1, 0)).toBeDefined()
    expect(renderer.cellData(5, 5)).toBeUndefined()
    expect(renderer.cellAt(165, 165)).toEqual({ x: 0, y: 0 })
    expect(renderer.visibleRange().minX).toBeLessThan(0)
  })

  it('pans and zooms', () => {
    const { renderer } = setup()
    renderer.panBy(32, 0)
    expect(renderer.getCamera().centerX).toBeCloseTo(-0.5)

    renderer.zoomAt(160, 160, 2)
    expect(renderer.getCamera().zoom).toBe(2)
  })

  it('uses the browser frame loop and scratch canvas by default', () => {
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(7)
    const caf = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const renderer = new MapRenderer(createFakeCanvas())
    renderer.setNow(1)
    renderer.dispose()

    expect(raf).toHaveBeenCalled()
    expect(caf).toHaveBeenCalledWith(7)
    raf.mockRestore()
    caf.mockRestore()
  })
})
