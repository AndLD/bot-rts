import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { ISupervisionState } from '@lib/utils/admin-players'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import SupervisionPage from './SupervisionPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

const state = (overrides: Partial<ISupervisionState> = {}): ISupervisionState => ({
  isPaused: false,
  areScriptsHalted: false,
  quarantined: [{ _id: 'p1', name: 'Alice' }],
  activeExecutions: 7,
  heldExecutions: 2,
  ...overrides
})

function serve(initial: ISupervisionState, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/supervision/state') return { data: initial }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <SupervisionPage />
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

// Role queries are slow on the large DOM of an Ant Design modal, so buttons are found by their text
const buttonsOf = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttonsOf(label).length).toBeGreaterThan(0)).then(() => buttonsOf(label)[0])
const dialog = () => document.querySelector('.ant-modal') as HTMLElement
const reasonField = () => dialog().querySelector('textarea') as HTMLTextAreaElement

beforeEach(() => jest.clearAllMocks())

describe('SupervisionPage', () => {
  it('shows the state of the world, of scripts and of the executions, and the quarantined players', async () => {
    serve(state())
    renderAs('owner')

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getAllByText('Running')).toHaveLength(2)
    expect(screen.getByText('Allowed')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('says so when nobody is quarantined and when the state cannot be loaded', async () => {
    serve(state({ quarantined: [] }))
    const { unmount } = renderAs('owner')
    expect(await screen.findByText('Nobody is quarantined')).toBeInTheDocument()
    unmount()

    serve(state(), (call) => (call.url.endsWith('/state') ? { error: { status: 500, data: {} } } : undefined))
    renderAs('owner')
    expect(await screen.findByText('Could not load the control state')).toBeInTheDocument()
  })

  it('shows each role only the controls it holds', async () => {
    serve(state())
    renderAs('moderator')
    await screen.findByText('Alice')

    expect(buttonsOf('Pause the world')).toHaveLength(0)
    expect(buttonsOf('Switch all scripts off')).toHaveLength(0)
    expect(buttonsOf('Release')).toHaveLength(0)
    expect(screen.queryByText('Support actions')).toBeNull()
  })

  it('pauses the world only after the word is typed', async () => {
    const calls = serve(state())
    renderAs('admin')
    fireEvent.click(await button('Pause the world'))
    fireEvent.change(reasonField(), { target: { value: 'database upgrade' } })
    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'pause' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() => expect(dialog().querySelector('.ant-form-item-explain-error')).not.toBeNull())
    expect(calls.some((call) => call.url.endsWith('/world/pause'))).toBe(false)

    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'PAUSE' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/world/pause'))).toMatchObject({
        method: 'POST',
        body: { reason: 'database upgrade', confirm: 'PAUSE' }
      })
    )
  })

  it('resumes a paused world and lets scripts run again, with a reason only', async () => {
    const calls = serve(state({ isPaused: true, areScriptsHalted: true }))
    renderAs('owner')
    expect(await screen.findByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Switched off')).toBeInTheDocument()

    fireEvent.click(await button('Resume the world'))
    fireEvent.change(reasonField(), { target: { value: 'upgrade done' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/world/resume'))).toBe(true))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    fireEvent.click(await button('Switch scripts back on'))
    fireEvent.change(reasonField(), { target: { value: 'sandbox fixed' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/scripts/allow'))?.body).toEqual({ reason: 'sandbox fixed' })
    )
  })

  it('switches scripts off after the word is typed', async () => {
    const calls = serve(state())
    renderAs('owner')
    fireEvent.click(await button('Switch all scripts off'))
    fireEvent.change(reasonField(), { target: { value: 'exploit found' } })
    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'HALT' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/scripts/halt'))?.body).toEqual({
        reason: 'exploit found',
        confirm: 'HALT'
      })
    )
  })

  it('lets the dialog of a switch be cancelled', async () => {
    serve(state())
    renderAs('admin')
    fireEvent.click(await button('Pause the world'))
    fireEvent.click(await button('Cancel'))

    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })

  it('keeps the dialog of a release open when the server refuses it', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve(state(), (call) =>
      call.url.endsWith('/release') ? { error: { status: 404, data: { code: 'NOT_FOUND' } } } : undefined
    )
    renderAs('admin')
    fireEvent.click(await button('Release'))
    fireEvent.change(reasonField(), { target: { value: 'cleared' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not found' })))
    expect(dialog()).toBeInTheDocument()
  })

  it('releases a quarantined player with a reason', async () => {
    const calls = serve(state())
    renderAs('admin')
    fireEvent.click(await button('Release'))
    fireEvent.change(reasonField(), { target: { value: 'cleared' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/players/p1/release'))).toMatchObject({
        body: { reason: 'cleared' }
      })
    )
  })

  it('tells why an action was refused and keeps the dialog', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve(state(), (call) =>
      call.url.endsWith('/world/resume') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined
    )
    renderAs('admin')
    fireEvent.click(await button('Release'))
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    serve(state({ isPaused: true }), (call) =>
      call.url.endsWith('/world/resume') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined
    )
    const second = renderAs('admin')
    fireEvent.click(
      (await screen.findAllByText('Resume the world'))
        .map((node) => node.closest('button'))
        .find(Boolean) as HTMLElement
    )
    fireEvent.change(reasonField(), { target: { value: 'because' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'You are not allowed to do this' }))
    )
    expect(dialog()).toBeInTheDocument()
    second.unmount()
  })
})

describe('the support form', () => {
  const botId = '11111111-1111-1111-1111-111111111111'
  const moduleId = '22222222-2222-2222-2222-222222222222'

  it('sends a grant with a resource and an amount', async () => {
    const calls = serve(state())
    renderAs('owner')
    fireEvent.change(await screen.findByLabelText('Bot or base id'), { target: { value: botId } })
    fireEvent.mouseDown(document.querySelectorAll('.ant-select-selector')[1])
    fireEvent.click(await screen.findByText('iron', { selector: '.ant-select-item-option-content' }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Reason (kept in the audit log)'), { target: { value: 'lost to a bug' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/support/grant-resources'))?.body).toEqual({
        botId,
        reason: 'lost to a bug',
        stacks: [{ resource: 'iron', amount: 25 }]
      })
    )
  })

  async function pick(label: string, index = 0) {
    fireEvent.mouseDown(document.querySelectorAll('.ant-select-selector')[index])
    fireEvent.click(await screen.findByText(label, { selector: '.ant-select-item-option-content' }))
  }

  function fill(extra: Record<string, string>) {
    fireEvent.change(screen.getByLabelText('Bot or base id'), { target: { value: botId } })
    fireEvent.change(screen.getByLabelText('Reason (kept in the audit log)'), { target: { value: 'because' } })
    Object.entries(extra).forEach(([label, value]) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    )
  }

  it('sends a module restore to its own route', async () => {
    const calls = serve(state())
    renderAs('owner')
    await screen.findByText('Support actions')
    await pick('Restore a module')
    fill({ 'Module id': moduleId })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/support/restore-module'))?.body).toEqual({
        botId,
        moduleId,
        reason: 'because'
      })
    )
  }, 180_000)

  it.each([
    ['Compensate (grant for a loss)', 'gold', '/support/compensate'],
    ['Remove resources', 'wood', '/support/remove-resources']
  ])(
    'sends %s to its own route',
    async (kindLabel, resource, path) => {
      const calls = serve(state())
      renderAs('owner')
      await screen.findByText('Support actions')
      await pick(kindLabel)
      await pick(resource, 1)
      fill({ Amount: '3' })
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

      await waitFor(() =>
        expect(calls.find((call) => call.url.endsWith(path))?.body).toMatchObject({ stacks: [{ resource, amount: 3 }] })
      )
    },
    180_000
  )
})
