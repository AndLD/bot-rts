import { act, fireEvent, render, screen } from '@testing-library/react'
import { useStickyScroll } from './useStickyScroll'

function Log({ lines, onFollow }: { lines: string[]; onFollow?: (follow: () => void) => void }) {
  const { ref, onScroll, follow } = useStickyScroll<HTMLDivElement>(lines)
  onFollow?.(follow)

  return (
    <div ref={ref} onScroll={onScroll} data-testid="log">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  )
}

// jsdom has no layout: the element reports the sizes of the test
function measure(element: HTMLElement, { height, client, top }: { height: number; client: number; top: number }) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => height })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => client })
  element.scrollTop = top
}

describe('useStickyScroll', () => {
  it('follows new content from the start', () => {
    const { rerender } = render(<Log lines={['a']} />)
    const log = screen.getByTestId('log')
    measure(log, { height: 500, client: 200, top: 0 })

    rerender(<Log lines={['a', 'b']} />)

    expect(log.scrollTop).toBe(500)
  })

  it('follows while the reader is at the bottom, within a few pixels', () => {
    const { rerender } = render(<Log lines={['a']} />)
    const log = screen.getByTestId('log')
    measure(log, { height: 500, client: 200, top: 298 })
    fireEvent.scroll(log)

    measure(log, { height: 700, client: 200, top: 298 })
    rerender(<Log lines={['a', 'b']} />)

    expect(log.scrollTop).toBe(700)
  })

  it('leaves a reader who scrolled up where they are, and follows again after they scroll back to the bottom', () => {
    const { rerender } = render(<Log lines={['a']} />)
    const log = screen.getByTestId('log')
    measure(log, { height: 500, client: 200, top: 100 })
    fireEvent.scroll(log)

    measure(log, { height: 600, client: 200, top: 100 })
    rerender(<Log lines={['a', 'b']} />)
    expect(log.scrollTop).toBe(100)

    measure(log, { height: 600, client: 200, top: 400 })
    fireEvent.scroll(log)
    measure(log, { height: 700, client: 200, top: 400 })
    rerender(<Log lines={['a', 'b', 'c']} />)
    expect(log.scrollTop).toBe(700)
  })

  it('follows after the reader acted on their own, wherever they were', () => {
    let follow = () => undefined as void
    const { rerender } = render(<Log lines={['a']} onFollow={(next) => (follow = next)} />)
    const log = screen.getByTestId('log')
    measure(log, { height: 500, client: 200, top: 0 })
    fireEvent.scroll(log)

    act(() => follow())
    measure(log, { height: 600, client: 200, top: 0 })
    rerender(<Log lines={['a', 'b']} onFollow={(next) => (follow = next)} />)

    expect(log.scrollTop).toBe(600)
  })

  it('does nothing when the element is not there', () => {
    function Empty() {
      const { onScroll } = useStickyScroll<HTMLDivElement>(0)
      onScroll()

      return null
    }

    expect(() => render(<Empty />)).not.toThrow()
  })
})
