import { act, render, screen } from '@testing-library/react'
import LazyAmbient, { AMBIENT_DELAY_MS } from './LazyAmbient'

jest.mock('../features/ambient/AmbientCanvas', () => ({ __esModule: true, default: () => null }))
// The loader of a dynamic import is run, the way Next.js runs it when the component is first shown
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (load: () => Promise<unknown>) => {
    void load()

    return function Scene() {
      return <div data-testid="ambient-scene" />
    }
  }
}))

describe('LazyAmbient', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('shows nothing until the page has settled, then the scene', () => {
    render(<LazyAmbient />)
    expect(screen.queryByTestId('ambient-scene')).not.toBeInTheDocument()

    act(() => jest.advanceTimersByTime(AMBIENT_DELAY_MS))

    expect(screen.getByTestId('ambient-scene')).toBeInTheDocument()
  })

  it('does not start the scene when the page goes away first', () => {
    const { unmount } = render(<LazyAmbient />)

    unmount()
    act(() => jest.advanceTimersByTime(AMBIENT_DELAY_MS))

    expect(screen.queryByTestId('ambient-scene')).not.toBeInTheDocument()
  })
})
