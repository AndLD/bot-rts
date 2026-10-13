import { GameEvent } from '@lib/utils/interfaces/events'
import { IMapCell, MapPointType } from '@lib/utils/interfaces/map'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import MapCanvas from './MapCanvas'
import { MapStore } from './MapStore'
import { TileLoader } from './TileLoader'

const renderer = {
  setCells: jest.fn(),
  setNow: jest.fn(),
  setAtlas: jest.fn(),
  setCamera: jest.fn(),
  setSelection: jest.fn(),
  resize: jest.fn(),
  panBy: jest.fn(),
  zoomAt: jest.fn(),
  cellAt: jest.fn(() => ({ x: 2, y: 3 })),
  visibleRange: jest.fn(() => ({ minX: 0, minY: 0, maxX: 5, maxY: 5 })),
  dispose: jest.fn(),
  requestRender: jest.fn(),
  getCamera: jest.fn(() => ({ centerX: 0, centerY: 0, zoom: 1 }))
}
const animations = { handle: jest.fn() }
jest.mock('./renderer/MapRenderer', () => ({ MapRenderer: jest.fn(() => renderer) }))
jest.mock('./animation/AnimationSystem', () => ({
  AnimationSystem: jest.fn((options: unknown) => Object.assign(animations, { options }))
}))
const loadAtlas = jest.fn()
jest.mock('./renderer/atlas', () => ({ loadAtlas: (...args: unknown[]) => loadAtlas(...args) }))

class FakeResizeObserver {
  static callback: () => void = () => undefined
  constructor(callback: () => void) {
    FakeResizeObserver.callback = callback
  }
  observe() {}
  disconnect() {}
}

function setup(
  center?: { x: number; y: number },
  onOpenBot?: (id: string) => void,
  isReducedMotion = false,
  layer?: React.ReactNode
) {
  const store = new MapStore()
  const loader = new TileLoader(jest.fn().mockResolvedValue({ now: 1, cells: [], liveAreas: [] }), store)
  const ensure = jest.spyOn(loader, 'ensure').mockResolvedValue()
  const view = (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <MapCanvas store={store} loader={loader} center={center} onOpenBot={onOpenBot} isReducedMotion={isReducedMotion}>
        {layer}
      </MapCanvas>
    </NextIntlClientProvider>
  )

  return { store, loader, ensure, ...render(view), view }
}

describe('MapCanvas', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    loadAtlas.mockResolvedValue({ image: {} })
    global.ResizeObserver = FakeResizeObserver as never
    // jsdom has no PointerEvent, which would lose the coordinates
    global.PointerEvent = MouseEvent as never
  })
  afterEach(() => jest.useRealTimers())

  const canvas = () => screen.getByTestId('map').querySelector('canvas') as HTMLCanvasElement
  const flushLoad = () => act(() => void jest.advanceTimersByTime(200))

  it('sizes the renderer, loads the atlas and asks for the visible tiles', async () => {
    const { ensure } = setup()
    await act(async () => undefined)
    flushLoad()

    expect(renderer.resize).toHaveBeenCalled()
    expect(renderer.setAtlas).toHaveBeenCalledWith({ image: {} })
    expect(ensure).toHaveBeenCalledWith({ minX: 0, minY: 0, maxX: 5, maxY: 5 })
  })

  it('hands the cells of the store to the renderer when they change', () => {
    const { store } = setup()
    renderer.setCells.mockClear()

    act(() => store.apply({ now: 1, cells: [{ x: 0, y: 0, type: null, contentId: null, seenAt: 1 }] }))

    expect(renderer.setCells).toHaveBeenCalled()
  })

  it('moves the clock every second', () => {
    setup()
    renderer.setNow.mockClear()

    act(() => void jest.advanceTimersByTime(1000))

    expect(renderer.setNow).toHaveBeenCalled()
  })

  it('looks at the given centre', () => {
    const { ensure } = setup({ x: 10, y: -4 })
    flushLoad()

    expect(renderer.setCamera).toHaveBeenCalledWith({ centerX: 10.5, centerY: -3.5, zoom: 1 })
    expect(ensure).toHaveBeenCalled()
  })

  it('asks again when tiles are invalidated', () => {
    const { loader, ensure } = setup()
    flushLoad()
    ensure.mockClear()

    act(() => loader.invalidate())
    flushLoad()

    expect(ensure).toHaveBeenCalledTimes(1)
  })

  it('pans by dragging and asks for what comes into view', () => {
    const { ensure } = setup()
    flushLoad()
    ensure.mockClear()

    fireEvent.pointerMove(canvas(), { clientX: 5, clientY: 5 })
    expect(renderer.panBy).not.toHaveBeenCalled()

    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas(), { clientX: 30, clientY: 25 })
    fireEvent.pointerUp(canvas(), { clientX: 30, clientY: 25 })
    flushLoad()

    expect(renderer.panBy).toHaveBeenCalledWith(20, 15)
    expect(ensure).toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('zooms with the wheel in both directions', () => {
    setup()

    fireEvent.wheel(canvas(), { deltaY: -100, clientX: 10, clientY: 20 })
    fireEvent.wheel(canvas(), { deltaY: 100, clientX: 10, clientY: 20 })

    expect(renderer.zoomAt.mock.calls[0][2]).toBeGreaterThan(1)
    expect(renderer.zoomAt.mock.calls[1][2]).toBeLessThan(1)
  })

  it('draws a layer over the canvas that does not stop a click from selecting a cell', () => {
    setup(undefined, undefined, false, <div data-testid="layer" style={{ pointerEvents: 'none' }} />)

    expect(screen.getByTestId('layer')).toBeInTheDocument()
    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas(), { clientX: 10, clientY: 10 })
    expect(screen.getByText('Cell 2, 3')).toBeInTheDocument()
  })

  it('selects the clicked cell and describes it, unknown cells included', () => {
    const { store } = setup()

    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas(), { clientX: 11, clientY: 10 })
    expect(screen.getByText('Cell 2, 3')).toBeInTheDocument()
    expect(screen.getByText('Unknown: never scanned')).toBeInTheDocument()
    expect(renderer.setSelection).toHaveBeenCalledWith({ x: 2, y: 3 })

    act(() => store.apply({ now: 1, cells: [{ x: 2, y: 3, type: null, contentId: null, seenAt: 1 }] }))
    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas(), { clientX: 10, clientY: 10 })
    expect(screen.getByText('Empty ground')).toBeInTheDocument()
  })

  it('opens the control panel of an own bot or base that is clicked, and of nobody else', () => {
    const onOpenBot = jest.fn()
    const { store } = setup(undefined, onOpenBot)
    const click = () => {
      fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
      fireEvent.pointerUp(canvas(), { clientX: 10, clientY: 10 })
    }
    const cell = (extra: { type: MapPointType; contentId: string | null; isOwn?: boolean }): IMapCell => ({
      x: 2,
      y: 3,
      seenAt: 1,
      ...extra
    })

    act(() => store.apply({ now: 1, cells: [cell({ type: MapPointType.BOT, contentId: 'bot-1', isOwn: true })] }))
    click()
    expect(onOpenBot).toHaveBeenLastCalledWith('bot-1')

    act(() => store.apply({ now: 1, cells: [cell({ type: MapPointType.BASE, contentId: 'base-1', isOwn: true })] }))
    click()
    expect(onOpenBot).toHaveBeenLastCalledWith('base-1')

    onOpenBot.mockClear()
    act(() => store.apply({ now: 1, cells: [cell({ type: MapPointType.BOT, contentId: 'bot-2', isOwn: false })] }))
    click()
    act(() => store.apply({ now: 1, cells: [cell({ type: MapPointType.RESOURCE, contentId: null })] }))
    click()
    act(() => store.apply({ now: 1, cells: [cell({ type: MapPointType.BOT, contentId: null, isOwn: true })] }))
    click()
    expect(onOpenBot).not.toHaveBeenCalled()
  })

  it('selects a cell without anyone to open when nothing wants to hear of it', () => {
    const { store } = setup()
    act(() =>
      store.apply({
        now: 1,
        cells: [{ x: 2, y: 3, seenAt: 1, type: MapPointType.BOT, contentId: 'bot-1', isOwn: true }]
      })
    )

    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas(), { clientX: 10, clientY: 10 })

    expect(screen.getByText('Cell 2, 3')).toBeInTheDocument()
  })

  it('ignores a release without a press', () => {
    setup()

    fireEvent.pointerUp(canvas(), { clientX: 10, clientY: 10 })

    expect(renderer.setSelection).not.toHaveBeenCalled()
  })

  it('stops everything when it goes away, even before the atlas arrived', async () => {
    let arrive: (atlas: unknown) => void = () => undefined
    loadAtlas.mockReturnValue(new Promise((resolve) => (arrive = resolve)))
    const { unmount } = setup()

    unmount()
    await act(async () => arrive({ image: {} }))

    expect(renderer.dispose).toHaveBeenCalled()
    expect(renderer.setAtlas).not.toHaveBeenCalled()
  })

  it('plays the game events of the store as animations, and draws again', () => {
    const { store } = setup()
    const event: GameEvent = { type: 'EnergyLow', at: 1, parties: [{ userId: 'u', botId: 'b1' }] }

    store.publishEvent(event)

    expect(animations.handle).toHaveBeenCalledWith(event)
    expect(renderer.requestRender).toHaveBeenCalled()
  })

  it('gives the animations what they need: the time, the bots, the zoom and the motion setting', () => {
    const { store, rerender, view } = setup(undefined, undefined, true)
    const options = (animations as unknown as { options: Record<string, () => unknown> }).options
    store.apply({ now: 1, cells: [{ x: 4, y: 5, type: MapPointType.BOT, contentId: 'b9', seenAt: 1 }] })

    expect(typeof options.now()).toBe('number')
    expect(options.locate).toBeDefined()
    expect((options.locate as unknown as (id: string) => unknown)('b9')).toEqual({ x: 4, y: 5 })
    expect(options.zoom()).toBe(1)
    expect(options.isReducedMotion()).toBe(true)
    rerender(view)
  })

  it('resizes with its container', () => {
    setup()
    renderer.resize.mockClear()

    act(() => FakeResizeObserver.callback())

    expect(renderer.resize).toHaveBeenCalled()
  })
})
