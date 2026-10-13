import { setupStore } from '../../shared/store'
import {
  closeWindow,
  DEFAULT_SIZES,
  focusWindow,
  LAYOUT_KEY,
  MIN_HEIGHT,
  MIN_WIDTH,
  openWindow,
  placeWindow
} from './windows.slice'

const windows = (store = setupStore()) => store.getState().windows

describe('windows slice', () => {
  beforeEach(() => localStorage.clear())

  it('opens windows cascaded, each in front of the last', () => {
    const store = setupStore()
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
    store.dispatch(openWindow({ id: 'b', kind: 'storage', params: { botId: 'b1' } }))

    const [a, b] = windows(store).windows
    expect(a).toMatchObject({ id: 'a', ...DEFAULT_SIZES.terminal, params: {} })
    expect(b).toMatchObject({ id: 'b', params: { botId: 'b1' } })
    expect(b.x).toBeGreaterThan(a.x)
    expect(b.z).toBeGreaterThan(a.z)
  })

  it('brings an open window to the front instead of opening it twice', () => {
    const store = setupStore()
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
    store.dispatch(openWindow({ id: 'b', kind: 'terminal' }))
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))

    const { windows: open } = windows(store)
    expect(open).toHaveLength(2)
    expect(open[0].z).toBeGreaterThan(open[1].z)
  })

  it('focuses a window, and leaves the one in front and unknown ones alone', () => {
    const store = setupStore()
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
    store.dispatch(openWindow({ id: 'b', kind: 'terminal' }))
    const before = windows(store).nextZ

    store.dispatch(focusWindow('b'))
    store.dispatch(focusWindow('nope'))
    expect(windows(store).nextZ).toBe(before)

    store.dispatch(focusWindow('a'))
    expect(windows(store).windows[0].z).toBe(before)
  })

  it('closes windows', () => {
    const store = setupStore()
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
    store.dispatch(closeWindow('a'))

    expect(windows(store).windows).toEqual([])
  })

  it('moves and resizes, never below the minimum size, and remembers the place', () => {
    const store = setupStore()
    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))

    store.dispatch(placeWindow({ id: 'a', x: 5, y: 6 }))
    store.dispatch(placeWindow({ id: 'a', width: 10, height: 10 }))
    store.dispatch(placeWindow({ id: 'nope', x: 1 }))

    expect(windows(store).windows[0]).toMatchObject({ x: 5, y: 6, width: MIN_WIDTH, height: MIN_HEIGHT })
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY) as string)).toEqual({
      a: { x: 5, y: 6, width: MIN_WIDTH, height: MIN_HEIGHT }
    })
  })

  it('opens a window where it was left the last time', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ a: { x: 300, y: 200, width: 500, height: 300 } }))
    const store = setupStore()

    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))

    expect(windows(store).windows[0]).toMatchObject({ x: 300, y: 200, width: 500, height: 300 })
  })

  describe('a layout saved before the control window got wider', () => {
    const narrow = { x: 40, y: 50, width: 480, height: 520 }

    it('widens the saved control window once, and leaves other windows and the height alone', () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ 'control:b1': narrow, terminal: narrow }))
      const store = setupStore()

      store.dispatch(openWindow({ id: 'control:b1', kind: 'control' }))
      store.dispatch(openWindow({ id: 'terminal', kind: 'terminal' }))

      const [control, terminal] = windows(store).windows
      expect(control).toMatchObject({ ...narrow, width: DEFAULT_SIZES.control.width })
      expect(terminal).toMatchObject(narrow)
      expect(JSON.parse(localStorage.getItem(LAYOUT_KEY) as string)['control:b1'].width).toBe(
        DEFAULT_SIZES.control.width
      )
    })

    it('keeps the width a player chooses afterwards', () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ 'control:b1': narrow }))
      const first = setupStore()
      first.dispatch(openWindow({ id: 'control:b1', kind: 'control' }))
      first.dispatch(placeWindow({ id: 'control:b1', width: 400 }))

      const second = setupStore()
      second.dispatch(openWindow({ id: 'control:b1', kind: 'control' }))

      expect(windows(second).windows[0].width).toBe(400)
    })

    it('does not narrow a window that is already wider', () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ 'control:b1': { ...narrow, width: 900 } }))
      const store = setupStore()

      store.dispatch(openWindow({ id: 'control:b1', kind: 'control' }))

      expect(windows(store).windows[0].width).toBe(900)
    })
  })

  it('works without storage and with a damaged layout', () => {
    localStorage.setItem(LAYOUT_KEY, '{not json')
    const failing = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = setupStore()

    store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
    store.dispatch(placeWindow({ id: 'a', x: 9 }))

    expect(windows(store).windows[0].x).toBe(9)
    failing.mockRestore()
  })
})
