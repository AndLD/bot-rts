import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import { ConnectionStatus, ConnectionStatusContext } from '../../shared/socket/socket-context'
import ConnectionBanner from './ConnectionBanner'

const show = (status: ConnectionStatus) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ConnectionStatusContext.Provider value={status}>
        <ConnectionBanner />
      </ConnectionStatusContext.Provider>
    </NextIntlClientProvider>
  )

describe('ConnectionBanner', () => {
  it('is not there while the connection holds', () => {
    show('connected')

    expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument()
  })

  it.each([
    ['lost', 'Connection to the server lost'],
    ['reconnecting', 'Reconnecting to the server…'],
    ['restored', 'Connection restored']
  ] as const)('tells that the connection is %s', (status, text) => {
    show(status)

    expect(screen.getByTestId('connection-banner')).toHaveTextContent(text)
  })
})
