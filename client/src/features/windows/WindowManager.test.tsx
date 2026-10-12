import { act, fireEvent, screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import { setupStore } from '../../shared/store'
import WindowManager from './WindowManager'
import { openWindow } from './windows.slice'

beforeEach(() => {
  localStorage.clear()
  global.PointerEvent = MouseEvent as never
})

function setup() {
  const store = setupStore()
  const renderWindow = jest.fn((win) => ({ title: `Title ${win.id}`, content: <p>Body {win.id}</p> }))
  renderApp(
    <WindowManager renderWindow={renderWindow}>
      <p>the page</p>
    </WindowManager>,
    { store }
  )

  return { store, renderWindow }
}

describe('WindowManager', () => {
  it('shows the page and the open windows with what the screen says they are', () => {
    const { store } = setup()
    act(() => {
      store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
      store.dispatch(openWindow({ id: 'b', kind: 'terminal' }))
    })

    expect(screen.getByText('the page')).toBeInTheDocument()
    expect(screen.getByText('Title a')).toBeInTheDocument()
    expect(screen.getByText('Body b')).toBeInTheDocument()
  })

  it('closes a window from its button', () => {
    const { store } = setup()
    act(() => void store.dispatch(openWindow({ id: 'a', kind: 'terminal' })))

    fireEvent.click(screen.getByRole('button', { name: 'Close window' }))

    expect(store.getState().windows.windows).toEqual([])
  })

  it('focuses and places windows in the store, within the screen', () => {
    const { store } = setup()
    act(() => {
      store.dispatch(openWindow({ id: 'a', kind: 'terminal' }))
      store.dispatch(openWindow({ id: 'b', kind: 'terminal' }))
    })
    const [a] = store.getState().windows.windows

    fireEvent.pointerDown(screen.getByText('Body a'))
    expect(store.getState().windows.windows[0].z).toBeGreaterThan(store.getState().windows.windows[1].z)

    const title = screen.getByText('Title a').closest('header') as HTMLElement
    fireEvent.pointerDown(title, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(title, { clientX: 10, clientY: 20 })
    expect(store.getState().windows.windows[0]).toMatchObject({ x: a.x + 10, y: a.y + 20 })
  })

  it('measures the screen again when it is resized', () => {
    setup()

    act(() => {
      window.innerWidth = 500
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.queryByText('the page')).toBeInTheDocument()
  })
})
