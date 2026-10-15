import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import messages from '../../../messages/en.json'
import { makeJwt } from '../../../tests/jwt'
import { storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import ViewAsBanner from './ViewAsBanner'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)
const assign = jest.fn()
const close = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(window, 'location', { value: { ...window.location, assign, search: '' }, writable: true })
  window.close = close
  query.mockResolvedValue({ data: {} } as never)
})
afterEach(() => {
  jest.useRealTimers()
  sessionStorage.clear()
  localStorage.clear()
})

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <ViewAsBanner />
      </Provider>
    </NextIntlClientProvider>
  )
}

const startView = (expiresAt = Date.now() + 600_000) =>
  sessionStorage.setItem('viewAs', JSON.stringify({ token: 'viewer', expiresAt, playerName: 'Alice' }))

describe('the banner of a view', () => {
  it('shows nothing in an ordinary tab', () => {
    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })

  it('names the player, says it is read-only and when it ends', async () => {
    startView(Date.UTC(2026, 5, 1, 14, 30))
    jest.useFakeTimers({ now: Date.UTC(2026, 5, 1, 14, 0), advanceTimers: true })
    renderBanner()

    expect(await screen.findByText('You are viewing the game of Alice — read-only')).toBeInTheDocument()
    expect(screen.getByText('The view ends at 2:30 PM')).toBeInTheDocument()
  })

  it('exits through the server, drops the view and leaves the tab', async () => {
    startView()
    renderBanner()
    fireEvent.click(await screen.findByRole('button', { name: 'Exit' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/players'))
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/view-as/exit', method: 'POST' }),
      expect.anything(),
      undefined
    )
    expect(close).toHaveBeenCalled()
    expect(sessionStorage.getItem('viewAs')).toBeNull()
    // The admin's own token, kept for the other tabs, is not touched
    expect(localStorage.getItem('token')).not.toBeNull()
  })

  it('leaves by itself when the time is up, without calling the server', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    startView(Date.now() + 1000)
    renderBanner()
    await screen.findByRole('button', { name: 'Exit' })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    expect(assign).toHaveBeenCalledWith('/admin/players')
    expect(query).not.toHaveBeenCalled()
  })
})
