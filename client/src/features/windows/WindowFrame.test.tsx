import { fireEvent, screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import WindowFrame from './WindowFrame'

beforeEach(() => {
  global.PointerEvent = MouseEvent as never
})

function setup() {
  const handlers = { onFocus: jest.fn(), onClose: jest.fn(), onPlace: jest.fn() }
  renderApp(
    <WindowFrame
      title="Terminal"
      x={100}
      y={80}
      width={400}
      height={300}
      z={4}
      viewport={{ width: 1000, height: 700 }}
      {...handlers}
    >
      <p>content</p>
    </WindowFrame>
  )
  const title = screen.getByText('Terminal').closest('header') as HTMLElement

  return { ...handlers, title, handle: screen.getByTestId('resize-handle') }
}

describe('WindowFrame', () => {
  it('shows the title and the content at its place and layer', () => {
    setup()

    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByText('Terminal').closest('section')).toHaveStyle({
      left: '100px',
      top: '80px',
      width: '400px',
      height: '300px',
      zIndex: '4'
    })
  })

  it('takes focus when pressed anywhere', () => {
    const { onFocus } = setup()

    fireEvent.pointerDown(screen.getByText('content'))

    expect(onFocus).toHaveBeenCalled()
  })

  it('closes without starting a drag', () => {
    const { onClose, onPlace } = setup()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Close window' }), { clientX: 1, clientY: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }))

    expect(onClose).toHaveBeenCalled()
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('moves with the title bar, and stays reachable on screen', () => {
    const { title, onPlace, onFocus } = setup()

    fireEvent.pointerMove(title, { clientX: 5, clientY: 5 })
    expect(onPlace).not.toHaveBeenCalled()

    fireEvent.pointerDown(title, { clientX: 10, clientY: 10 })
    expect(onFocus).toHaveBeenCalled()
    fireEvent.pointerMove(title, { clientX: 40, clientY: 30 })
    expect(onPlace).toHaveBeenLastCalledWith({ x: 130, y: 100 })

    fireEvent.pointerMove(title, { clientX: 5000, clientY: 5000 })
    expect(onPlace).toHaveBeenLastCalledWith({ x: 940, y: 640 })

    fireEvent.pointerMove(title, { clientX: -5000, clientY: -5000 })
    expect(onPlace).toHaveBeenLastCalledWith({ x: -340, y: 0 })

    fireEvent.pointerUp(title)
    onPlace.mockClear()
    fireEvent.pointerMove(title, { clientX: 50, clientY: 50 })
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('resizes with the corner handle and stops when cancelled', () => {
    const { handle, onPlace } = setup()

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 380 })
    fireEvent.pointerMove(handle, { clientX: 540, clientY: 420 })
    expect(onPlace).toHaveBeenLastCalledWith({ width: 440, height: 340 })

    fireEvent.pointerCancel(handle)
    onPlace.mockClear()
    fireEvent.pointerMove(handle, { clientX: 600, clientY: 600 })
    expect(onPlace).not.toHaveBeenCalled()
  })
})
