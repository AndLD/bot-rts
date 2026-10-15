import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import DevToolsPage from './DevToolsPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

const player = {
  userId: 'u1',
  email: 'player-ab@devtools.test',
  password: 'Dev-ab-1',
  botPassword: 'bot-ab',
  baseId: 'base-1'
}

function serve(handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    return handler(args) ?? { data: { isEnabled: true } }
  }) as never)

  return calls
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider
          value={{ role: 'owner', permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}
        >
          <DevToolsPage />
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

const buttonsOf = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttonsOf(label).length).toBeGreaterThan(0)).then(() => buttonsOf(label)[0])
const dialog = () => document.querySelector('.ant-modal') as HTMLElement
const confirmWith = async (reason: string) => {
  await waitFor(() => expect(dialog()).not.toBeNull())
  fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: reason } })
  fireEvent.click(await button('Confirm'))
}

beforeEach(() => jest.clearAllMocks())

describe('DevToolsPage', () => {
  it('says the tools are off on a server that answers 404', async () => {
    serve(() => ({ error: { status: 404, data: {} } }))
    renderPage()

    expect(await screen.findByText(/The dev tools are off on this server/)).toBeInTheDocument()
  })

  it('creates test players and shows how to sign in as them', async () => {
    const calls = serve((call) =>
      call.url.endsWith('/seed-world')
        ? { data: { players: [player, { ...player, userId: 'u2', baseId: null }] } }
        : undefined
    )
    renderPage()

    fireEvent.click(await button('Create test players'))
    await confirmWith('a test world')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/seed-world'))?.body).toEqual({ count: 3, reason: 'a test world' })
    )
    expect(await screen.findAllByText('Dev-ab-1')).toHaveLength(2)
    expect(screen.getByText('No base placed')).toBeInTheDocument()
    expect(screen.getByText('base-1')).toBeInTheDocument()
  })

  it('removes the test players and says how many', async () => {
    const calls = serve((call) => (call.method === 'DELETE' ? { data: { removed: 2 } } : undefined))
    renderPage()

    fireEvent.click(await button('Remove all test players'))
    await confirmWith('clean up')

    await waitFor(() => expect(calls.find((call) => call.method === 'DELETE')?.body).toEqual({ reason: 'clean up' }))
    expect(await screen.findByText('2 test players removed')).toBeInTheDocument()
    fireEvent.click(document.querySelector('.ant-alert-close-icon') as Element)
    await waitFor(() => expect(screen.queryByText('2 test players removed')).not.toBeInTheDocument())
  })

  it('keeps the dialog when the server refuses, and clears the list after a removal', async () => {
    let refuse = true
    serve((call) =>
      call.url.endsWith('/seed-world')
        ? refuse
          ? { error: { status: 400, data: { code: 'VALIDATION' } } }
          : { data: { players: [player] } }
        : call.method === 'DELETE'
          ? { data: { removed: 1 } }
          : undefined
    )
    renderPage()
    fireEvent.click(await button('Create test players'))
    await confirmWith('because')
    await waitFor(() => expect(buttonsOf('Confirm')).toHaveLength(1))
    expect(dialog()).toBeInTheDocument()

    refuse = false
    fireEvent.click(await button('Confirm'))
    expect(await screen.findByText('Dev-ab-1')).toBeInTheDocument()

    fireEvent.click(await button('Remove all test players'))
    await confirmWith('clean up')
    await waitFor(() => expect(screen.queryByText('Dev-ab-1')).not.toBeInTheDocument())
  })

  it('keeps the dialog when removing is refused, and closes it on cancel', async () => {
    serve((call) => (call.method === 'DELETE' ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined))
    renderPage()
    fireEvent.click(await button('Remove all test players'))
    await confirmWith('clean up')

    await waitFor(() => expect(buttonsOf('Confirm')).toHaveLength(1))
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })

  it('resets the database after the typed word, with a reason, and says what it did', async () => {
    const calls = serve((call) =>
      call.url.endsWith('/reset-database') ? { data: { tablesEmptied: 21, accountsErased: 4 } } : undefined
    )
    renderPage()
    fireEvent.click(await button('Reset the database'))
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'a clean slate' } })

    // Without the word nothing is sent
    fireEvent.click(await button('Confirm'))
    expect(await screen.findByText('Type RESET to confirm')).toBeInTheDocument()
    expect(calls.some((call) => call.url.endsWith('/reset-database'))).toBe(false)

    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'RESET' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/reset-database'))?.body).toEqual({
        confirmation: 'RESET',
        reason: 'a clean slate'
      })
    )
    expect(await screen.findByText('The database was reset: 21 tables emptied, 4 accounts erased.')).toBeInTheDocument()
  })

  it('keeps the dialog of the reset when the server refuses it', async () => {
    const calls = serve((call) =>
      call.url.endsWith('/reset-database') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined
    )
    renderPage()
    fireEvent.click(await button('Reset the database'))
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'a clean slate' } })
    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'RESET' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/reset-database'))).toBe(true))
    expect(dialog()).not.toBeNull()
  })

  it('shows nothing while it asks whether the tools are on', () => {
    query.mockImplementation((() => new Promise(() => undefined)) as never)
    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })
})
