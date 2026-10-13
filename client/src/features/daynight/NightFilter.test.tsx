import { fireEvent, render, screen } from '@testing-library/react'
import { DAY_PHASE } from '@lib/utils/game-time'
import NightFilter from './NightFilter'

describe('NightFilter', () => {
  it.each([
    [DAY_PHASE.NIGHT, '0.65'],
    [DAY_PHASE.MORNING, '0.25'],
    [DAY_PHASE.DAY, '0'],
    [DAY_PHASE.EVENING, '0.25']
  ])('covers the map with strength %s -> %s', (phase, opacity) => {
    render(<NightFilter phase={phase} isReducedMotion={false} />)

    expect(screen.getByTestId('night-filter')).toHaveStyle({ opacity })
  })

  it('is invisible until the time is known', () => {
    render(<NightFilter phase={undefined} isReducedMotion={false} />)

    expect(screen.getByTestId('night-filter')).toHaveStyle({ opacity: '0' })
  })

  it('fades smoothly, and changes at once for a player who prefers less motion', () => {
    const { rerender } = render(<NightFilter phase={DAY_PHASE.NIGHT} isReducedMotion={false} />)
    expect(screen.getByTestId('night-filter').style.transition).toBe('opacity 20s linear')

    rerender(<NightFilter phase={DAY_PHASE.NIGHT} isReducedMotion />)
    expect(screen.getByTestId('night-filter').style.transition).toBe('none')
  })

  it('lets pointer events through to the map', () => {
    const onClick = jest.fn()
    render(
      <div onClick={onClick}>
        <NightFilter phase={DAY_PHASE.NIGHT} isReducedMotion={false} />
      </div>
    )

    expect(screen.getByTestId('night-filter')).toHaveStyle({ pointerEvents: 'none' })
    fireEvent.click(screen.getByTestId('night-filter'))
    expect(onClick).toHaveBeenCalled()
  })
})
