import { screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import AuthFrame from './AuthFrame'

jest.mock('../ambient/AmbientCanvas', () => ({
  __esModule: true,
  default: () => <div data-testid="ambient-scene" />
}))

describe('AuthFrame', () => {
  it('puts the card over the ambient scene, with a way back to the landing page and a language choice', () => {
    renderApp(<AuthFrame>content</AuthFrame>)

    expect(screen.getByTestId('ambient-scene')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bot RTS' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument()
  })

  it('can leave the language choice out', () => {
    renderApp(<AuthFrame hasLanguage={false}>content</AuthFrame>)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
