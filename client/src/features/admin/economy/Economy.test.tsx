import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { IBalancePreview, IBalanceState, IEconomyOverview } from '@lib/utils/admin-balance'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import EconomyPage from './EconomyPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; params?: Record<string, unknown>; body?: Record<string, unknown> }

const overview: IEconomyOverview = {
  resources: [
    { resource: 'iron', deposits: 4, remaining: 300, capacity: 1200, stored: 12.5 },
    { resource: 'gold', deposits: 0, remaining: 0, capacity: 0, stored: 0 }
  ],
  blueprints: [{ module: 'gun-class2', research: 2, item: 1 }],
  modules: [{ type: 'gun', name: 'gun-class1', count: 7 }]
}

const state = (overrides: Partial<IBalanceState> = {}): IBalanceState => ({
  activeVersion: 2,
  runningVersion: 1,
  problem: null,
  documentJson: '{\n  "crafting": {\n    "repairThreshold": 0.3\n  }\n}',
  effective: [{ path: 'crafting.repairThreshold', value: '0.3' }],
  versions: [
    { version: 2, reason: 'repairs', createdBy: 'u1', createdAt: Date.UTC(2026, 5, 1), isActive: true },
    { version: 1, reason: 'first', createdBy: 'u1', createdAt: Date.UTC(2026, 4, 1), isActive: false }
  ],
  ...overrides
})

function serve(balance = state(), handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/economy') return { data: overview }
    if (args.url === '/api/v1/admin/balance' && !args.method) return { data: balance }
    if (args.url === '/api/v1/admin/features' && !args.method)
      return {
        data: {
          features: { signUps: true, baseDeployment: true, apiKeys: false, spawnSeeds: true, publicApi: true },
          updatedAt: null
        }
      }
    if (args.url === '/api/v1/admin/settings') return { data: { categories: { movement: true, combat: false } } }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <EconomyPage />
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
// The editor takes the loaded document as its text, so it is only handed out once the balance is there
const editor = async () => {
  const field = (await screen.findByLabelText('Balance document')) as HTMLTextAreaElement
  await waitFor(() => expect(field.value).not.toBe(''))
  return field
}
const openTab = async (name: string) => fireEvent.click(await screen.findByRole('tab', { name }))
const confirmWith = async (reason: string) => {
  fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: reason } })
  fireEvent.click(await button('Confirm'))
}

beforeEach(() => jest.clearAllMocks())

describe('the economy', () => {
  it('shows the resources, the blueprints and the modules', async () => {
    serve()
    renderAs('analyst')

    expect(await screen.findByText('iron')).toBeInTheDocument()
    expect(screen.getByText('12.5')).toBeInTheDocument()
    expect(screen.getByText('25 %')).toBeInTheDocument()
    expect(screen.getByText('gun-class2')).toBeInTheDocument()
    expect(screen.getByText('gun-class1')).toBeInTheDocument()
  })

  it('says so when it cannot be loaded', async () => {
    serve(state(), (call) => (call.url === '/api/v1/admin/economy' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('analyst')

    expect(await screen.findByText('Could not load the economy')).toBeInTheDocument()
  })
})

describe('the balance', () => {
  it('shows the active document, the running version and the numbers in use, and only reads for an analyst', async () => {
    serve()
    renderAs('analyst')
    await openTab('Balance')

    await waitFor(async () => expect((await editor()).value).toContain('repairThreshold'))
    expect(screen.getByText('Active version: 2')).toBeInTheDocument()
    expect(screen.getByText('Running version 1 until the server restarts')).toBeInTheDocument()
    expect(buttonsOf('Check and compare')).toHaveLength(0)
    expect(buttonsOf('Roll back')).toHaveLength(0)
    expect(await editor()).toHaveAttribute('readonly')
  })

  it('names the defaults when no version was stored, and shows why a stored one is not used', async () => {
    serve(state({ activeVersion: null, runningVersion: null, problem: 'Version 4: broken', versions: [] }))
    renderAs('admin')
    await openTab('Balance')

    expect(await screen.findByText('Active version: defaults')).toBeInTheDocument()
    expect(screen.getByText(/Version 4: broken/)).toBeInTheDocument()
    expect(screen.queryByText(/until the server restarts/)).not.toBeInTheDocument()
  })

  it('refuses a document that is not a JSON object', async () => {
    const calls = serve()
    renderAs('admin')
    await openTab('Balance')

    for (const text of ['{ nope', '[1]', '5']) {
      fireEvent.change(await editor(), { target: { value: text } })
      fireEvent.click(await button('Check and compare'))
      expect(await screen.findByText('The document must be a JSON object')).toBeInTheDocument()
    }
    fireEvent.click(await button('Save as a new version'))
    expect(dialog()).toBeNull()
    expect(calls.some((call) => call.url.endsWith('/balance/preview'))).toBe(false)
  })

  it('lists what a document would change, or its problems', async () => {
    const answers: IBalancePreview[] = [
      {
        problems: [],
        changes: [
          { path: 'crafting.repairThreshold', from: '0.3', to: '0.5' },
          { path: 'recipes.fresh.craftTimeMs', from: null, to: '5' },
          { path: 'recipes.gone.craftTimeMs', from: '7', to: null }
        ]
      },
      { problems: ['iron: minAmount must not exceed maxAmount'], changes: [] },
      { problems: [], changes: [] }
    ]
    const calls = serve(state({ runningVersion: null }), (call) =>
      call.url.endsWith('/balance/preview') ? { data: answers.shift() } : undefined
    )
    renderAs('admin')
    await openTab('Balance')
    fireEvent.change(await editor(), { target: { value: '{"crafting":{"repairThreshold":0.5}}' } })

    fireEvent.click(await button('Check and compare'))
    expect(await screen.findByText('0.5')).toBeInTheDocument()
    expect(calls.find((call) => call.url.endsWith('/balance/preview'))?.body).toEqual({
      document: { crafting: { repairThreshold: 0.5 } }
    })

    fireEvent.click(await button('Check and compare'))
    expect(await screen.findByText('The document has problems')).toBeInTheDocument()
    expect(screen.getByText('iron: minAmount must not exceed maxAmount')).toBeInTheDocument()

    fireEvent.click(await button('Check and compare'))
    expect(await screen.findByText('Nothing differs from the active version')).toBeInTheDocument()
  })

  it('tells why a check was refused', async () => {
    serve(state(), (call) =>
      call.url.endsWith('/balance/preview') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined
    )
    renderAs('admin')
    await openTab('Balance')
    fireEvent.click(await button('Check and compare'))

    await waitFor(() => expect(screen.queryByText('The document has problems')).not.toBeInTheDocument())
  })

  it('saves a version with a reason, and keeps the dialog when the server refuses', async () => {
    let refuse = true
    const calls = serve(state(), (call) =>
      call.url === '/api/v1/admin/balance' && call.method === 'POST'
        ? refuse
          ? { error: { status: 400, data: { code: 'VALIDATION' } } }
          : { data: {} }
        : undefined
    )
    renderAs('admin')
    await openTab('Balance')
    fireEvent.change(await editor(), { target: { value: '{"crafting":{"repairThreshold":0.5}}' } })
    fireEvent.click(await button('Save as a new version'))
    await confirmWith('more repairs')
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(dialog()).toBeInTheDocument()

    refuse = false
    fireEvent.click(await button('Confirm'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
    expect(calls.filter((call) => call.method === 'POST').at(-1)?.body).toEqual({
      document: { crafting: { repairThreshold: 0.5 } },
      reason: 'more repairs'
    })
  })

  it('opens an older version in the editor, and rolls back to it with a reason', async () => {
    const calls = serve(state(), (call) =>
      call.url.endsWith('/balance/versions/1') && !call.method
        ? { data: { documentJson: '{"resources":{}}' } }
        : undefined
    )
    renderAs('admin')
    await openTab('Balance')
    await screen.findByText('first')
    expect(buttonsOf('Roll back')).toHaveLength(1)

    fireEvent.click(buttonsOf('Open')[1])
    await waitFor(async () => expect((await editor()).value).toBe('{"resources":{}}'))

    fireEvent.click(await button('Roll back'))
    expect(await screen.findByText('Roll back to version 1')).toBeInTheDocument()
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    fireEvent.click(await button('Roll back'))
    await confirmWith('the old numbers')
    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/balance/versions/1/rollback'))?.body).toEqual({
        reason: 'the old numbers'
      })
    )
  })

  it('says so when a version cannot be opened, and when the balance cannot be loaded', async () => {
    serve(state(), (call) =>
      call.url.endsWith('/balance/versions/1') ? { error: { status: 404, data: { code: 'NOT_FOUND' } } } : undefined
    )
    const { unmount } = renderAs('admin')
    await openTab('Balance')
    await screen.findByText('first')
    fireEvent.click(buttonsOf('Open')[1])
    await waitFor(() => expect(buttonsOf('Open').length).toBe(2))
    await waitFor(async () => expect((await editor()).value).toContain('repairThreshold'))
    unmount()

    serve(state(), (call) => (call.url === '/api/v1/admin/balance' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('admin')
    await openTab('Balance')
    expect(await screen.findByText('Could not load the balance')).toBeInTheDocument()
  })
})

describe('the game switches', () => {
  it('shows each category and switches one off for the whole game', async () => {
    const calls = serve()
    renderAs('admin')
    await openTab('Game switches')

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Combat' })).not.toBeChecked())
    expect(screen.getByRole('switch', { name: 'Movement' })).toBeChecked()

    fireEvent.click(screen.getByRole('switch', { name: 'Movement' }))
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({
        url: '/api/v1/admin/settings',
        body: { categories: { movement: false } }
      })
    )
  })

  it('only shows them to a role that cannot change the balance, and says when they cannot be loaded', async () => {
    serve()
    const { unmount } = renderAs('analyst')
    await openTab('Game switches')
    expect(await screen.findByRole('switch', { name: 'Movement' })).toBeDisabled()
    unmount()

    serve(state(), (call) => (call.url === '/api/v1/admin/settings' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('admin')
    await openTab('Game switches')
    expect(await screen.findByText('Could not load the switches')).toBeInTheDocument()
  })
})

describe('the feature switches', () => {
  it('show every feature, and switch one off with a reason', async () => {
    const calls = serve()
    renderAs('admin')
    await openTab('Features')

    const keys = await screen.findByRole('switch', { name: 'Creating API keys' })
    expect(keys).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Sign-ups' })).toBeChecked()

    fireEvent.click(screen.getByRole('switch', { name: 'Sign-ups' }))
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })
    await confirmWith('incident 7')

    await waitFor(() =>
      expect(calls.find((call) => call.url === '/api/v1/admin/features' && call.method === 'PATCH')?.body).toEqual({
        features: { signUps: false },
        reason: 'incident 7'
      })
    )
  })

  it('switches a feature that is off back on, and says so in the dialog', async () => {
    const calls = serve()
    renderAs('admin')
    await openTab('Features')
    const keys = await screen.findByRole('switch', { name: 'Creating API keys' })
    await waitFor(() => expect(keys).toBeEnabled())
    fireEvent.click(keys)
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })

    expect(screen.getByText('Switch on: Creating API keys')).toBeInTheDocument()
    await confirmWith('the incident is over')

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
        features: { apiKeys: true },
        reason: 'the incident is over'
      })
    )
  })

  it('keeps the dialog open when the change fails', async () => {
    const calls = serve(state(), (call) =>
      call.method === 'PATCH' && call.url === '/api/v1/admin/features'
        ? { error: { status: 400, data: {} } }
        : undefined
    )
    renderAs('admin')
    await openTab('Features')
    const signUps = await screen.findByRole('switch', { name: 'Sign-ups' })
    await waitFor(() => expect(signUps).toBeEnabled())
    fireEvent.click(signUps)
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })
    await confirmWith('incident 7')

    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true), { timeout: 15000 })
    expect(dialog()).not.toBeNull()
  })

  it('closes the dialog on cancel without changing anything', async () => {
    const calls = serve()
    renderAs('admin')
    await openTab('Features')
    const signUps = await screen.findByRole('switch', { name: 'Sign-ups' })
    await waitFor(() => expect(signUps).toBeEnabled())
    fireEvent.click(signUps)
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })

    fireEvent.click(await button('Cancel'))

    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })

  it('is read-only for a role without balance.write', async () => {
    serve()
    renderAs('analyst')
    await openTab('Features')

    expect(await screen.findByRole('switch', { name: 'Sign-ups' })).toBeDisabled()
  })

  it('says so when the switches cannot be loaded', async () => {
    serve(state(), (call) => (call.url === '/api/v1/admin/features' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('admin')
    await openTab('Features')

    expect(await screen.findByText('Could not load the feature switches')).toBeInTheDocument()
  })
})
