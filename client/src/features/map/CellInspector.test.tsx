import { screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import CellInspector from './CellInspector'

describe('CellInspector', () => {
  it('shows where the cell is, what is on it and how old the information is', () => {
    renderApp(
      <CellInspector
        x={3}
        y={-4}
        description={{
          title: { key: 'resources.gold', values: { amount: 12 } },
          details: [
            { key: 'deposit', values: { amount: 12 } },
            { key: 'seenAgo', values: { seconds: 7 } }
          ]
        }}
      />
    )

    expect(screen.getByText('Cell 3, -4')).toBeInTheDocument()
    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(screen.getByText('12 left in the deposit')).toBeInTheDocument()
    expect(screen.getByText('Seen 7 s ago')).toBeInTheDocument()
  })
})
