import { fireEvent, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import ApiKeysCard from './ApiKeysCard'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const key = (overrides = {}) => ({
  _id: 'k1',
  name: 'Dashboard',
  prefix: 'botrts_ab12',
  scopes: ['read', 'files'],
  ratePerMinute: 120,
  createdAt: 1,
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  ...overrides
})
// Role queries are slow on the large DOM of an Ant Design modal, so buttons are found by their text
const buttons = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttons(label).length).toBeGreaterThan(0)).then(() => buttons(label)[0])
const dialogOf = () => document.querySelector('.ant-modal') as HTMLElement
const opts = () => ({ store: storeWithToken(makeJwt(60)) })

type Call = { url: string; method?: string; body?: unknown }

function serve(initial: unknown[], onCall: (call: Call) => unknown = () => undefined) {
  let keys = initial
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = onCall(args)
    if (custom) return custom
    if (args.method === 'POST') {
      const created = key({ _id: 'k2', name: (args.body as { name: string }).name })
      keys = [created, ...keys]
      return { data: { ...created, secret: 'botrts_the-whole-secret' } }
    }
    if (args.method === 'DELETE') {
      keys = keys.map((k) => ((k as { _id: string })._id === 'k1' ? { ...(k as object), revokedAt: 5 } : k))
      return { data: {} }
    }
    return { data: keys }
  }) as never)
  return calls
}

describe('ApiKeysCard', () => {
  beforeEach(() => {
    query.mockReset()
    jest.restoreAllMocks()
  })

  it('lists the keys with their scopes and state, and says when there are none', async () => {
    serve([
      key(),
      key({ _id: 'old', name: 'Old', revokedAt: 5, lastUsedAt: 1000 }),
      key({ _id: 'gone', name: 'Stale', expiresAt: 1 })
    ])
    renderApp(<ApiKeysCard />, opts())

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.getAllByText('botrts_ab12…')).toHaveLength(3)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('revoked')).toBeInTheDocument()
    expect(screen.getByText('expired')).toBeInTheDocument()
    expect(screen.getAllByText('read').length).toBeGreaterThan(0)
    expect(buttons('Revoke')).toHaveLength(1)
  })

  it('says it has no keys', async () => {
    serve([])
    renderApp(<ApiKeysCard />, opts())

    expect(await screen.findByText('You have no API keys.')).toBeInTheDocument()
  })

  it('creates a key with the chosen scopes and shows the secret once', async () => {
    const calls = serve([])
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Create a key'))
    await waitFor(() => expect(dialogOf()).not.toBeNull())
    const dialog = dialogOf()
    fireEvent.change(dialog.querySelector('input#name') as HTMLElement, { target: { value: 'My bot' } })
    fireEvent.click(dialog.querySelector('input[type=checkbox][value=files]') as HTMLElement)
    fireEvent.click(buttons('Create').find((candidate) => dialog.contains(candidate)) as HTMLElement)

    expect(await screen.findByDisplayValue('botrts_the-whole-secret')).toBeInTheDocument()
    expect(screen.getByText(/It is not shown again/)).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.body).toMatchObject({ name: 'My bot', scopes: ['read', 'files'], ratePerMinute: 120 })

    fireEvent.click(await button('Done'))
    expect(await screen.findByText('My bot')).toBeInTheDocument()
  })

  it('copies the secret', async () => {
    serve([])
    const writeText = jest.fn()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Create a key'))
    await waitFor(() => expect(dialogOf()).not.toBeNull())
    const dialog = dialogOf()
    fireEvent.change(dialog.querySelector('input#name') as HTMLElement, { target: { value: 'k' } })
    fireEvent.click(buttons('Create').find((candidate) => dialog.contains(candidate)) as HTMLElement)
    await screen.findByDisplayValue('botrts_the-whole-secret')

    fireEvent.click(await button('Copy'))

    expect(writeText).toHaveBeenCalledWith('botrts_the-whole-secret')
  })

  it('reports a refusal to create a key', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve([], (call) =>
      call.method === 'POST' ? { error: { status: 409, data: { code: 'TOO_MANY_API_KEYS', error: 'x' } } } : undefined
    )
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Create a key'))
    await waitFor(() => expect(dialogOf()).not.toBeNull())
    const dialog = dialogOf()
    fireEvent.change(dialog.querySelector('input#name') as HTMLElement, { target: { value: 'k' } })
    fireEvent.click(buttons('Create').find((candidate) => dialog.contains(candidate)) as HTMLElement)

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'You already have the most API keys allowed, revoke one first' })
      )
    )
  })

  it('revokes a key after a confirmation', async () => {
    const calls = serve([key()])
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Revoke'))
    await waitFor(() => expect(buttons('Revoke')).toHaveLength(2))
    fireEvent.click(buttons('Revoke')[1])

    expect(await screen.findByText('revoked')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
  })

  it('shows the error when a key cannot be revoked', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve([key()], (call) =>
      call.method === 'DELETE' ? { error: { status: 404, data: { code: 'NOT_FOUND', error: 'x' } } } : undefined
    )
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Revoke'))
    await waitFor(() => expect(buttons('Revoke')).toHaveLength(2))
    fireEvent.click(buttons('Revoke')[1])

    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not found' })))
  })

  it('closes the form without making a key, and the secret with its cross', async () => {
    const calls = serve([])
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Create a key'))
    await waitFor(() => expect(dialogOf()).not.toBeNull())

    fireEvent.click(await button('Cancel'))
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    fireEvent.click(await button('Create a key'))
    fireEvent.change(dialogOf().querySelector('input#name') as HTMLElement, { target: { value: 'k' } })
    fireEvent.click(buttons('Create').find((candidate) => dialogOf().contains(candidate)) as HTMLElement)
    await screen.findByDisplayValue('botrts_the-whole-secret')
    // Copying without a clipboard does not fail
    fireEvent.click(await button('Copy'))
    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement)

    await waitFor(() =>
      expect(document.querySelectorAll('.ant-modal-wrap[style*="display: none"]').length).toBeGreaterThan(0)
    )
  })

  it('chooses an expiry and sends it', async () => {
    const calls = serve([])
    renderApp(<ApiKeysCard />, opts())
    fireEvent.click(await button('Create a key'))
    await waitFor(() => expect(dialogOf()).not.toBeNull())
    fireEvent.change(dialogOf().querySelector('input#name') as HTMLElement, { target: { value: 'k' } })
    fireEvent.mouseDown(dialogOf().querySelector('.ant-select-selector') as HTMLElement)
    fireEvent.click(await screen.findByText('After 90 days'))
    fireEvent.click(buttons('Create').find((candidate) => dialogOf().contains(candidate)) as HTMLElement)

    await screen.findByDisplayValue('botrts_the-whole-secret')
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ expiresInDays: 90 })
  })
})
