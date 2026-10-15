import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import { configOf, DEFAULT_GAME_TIME_SETTINGS, GameTimeSettings, IGameTimeAdmin } from '@lib/utils/game-time'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import GameTimePage from './GameTimePage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

// An instant at which the default day (24 minutes from the epoch) reads 12:00, and one at which Kyiv reads 15:00 (12:00 UTC in June)
const NOON_IN_GAME = 1_800_000_000_000 - (1_800_000_000_000 % (24 * 60_000)) + 12 * 60_000
const NOON_UTC = Date.UTC(2026, 5, 1, 12, 0, 0)

const shown = (settings: Partial<GameTimeSettings> = {}, canAdvance = true, now = NOON_IN_GAME): IGameTimeAdmin => {
  const full = { ...DEFAULT_GAME_TIME_SETTINGS, ...settings }

  return { settings: full, config: configOf(full), now, canAdvance }
}

function serve(data: IGameTimeAdmin, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom

    return { data }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <GameTimePage />
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
  await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })
  fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: reason } })
  fireEvent.click(await button('Confirm'))
}

// The page counts the game time on from the server's instant with the browser's clock; holding that still makes the clock exact
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
})
afterEach(() => jest.restoreAllMocks())

describe('the Game time page', () => {
  it('shows the clock, the part of the day, the sunlight and the mode', async () => {
    serve(shown())
    renderAs('admin')

    expect(await screen.findByTestId('game-time-clock')).toHaveTextContent('12:00')
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('100 %')).toBeInTheDocument()
    expect(screen.getByText('Day cycle of 24 min')).toBeInTheDocument()
    expect(screen.getByText('real time')).toBeInTheDocument()
  })

  it('shows the real-world mode and a clock that is ahead', async () => {
    serve(shown({ mode: 'realWorld', timeZone: 'Europe/Kyiv', offsetMs: 90 * 60_000 }, true, NOON_UTC))
    renderAs('admin')

    expect(await screen.findByText('Real-world time of Europe/Kyiv')).toBeInTheDocument()
    expect(screen.getByText('ahead of real time by 1 h 30 min')).toBeInTheDocument()
    expect(screen.getByTestId('game-time-clock')).toHaveTextContent('15:00')
  })

  it('says so when the game time cannot be loaded', async () => {
    serve(shown(), () => ({ error: { status: 500, data: {} } }))
    renderAs('admin')

    expect(await screen.findByText('Could not load the game time')).toBeInTheDocument()
  })

  it('is read-only for an admin without the permission, and offers no change', async () => {
    serve(shown())
    renderAs('moderator')

    expect(await screen.findByText(/You can read the game time/)).toBeInTheDocument()
    expect(buttonsOf('Set the length')).toHaveLength(0)
  })

  it('changes the length of the day to a preset, with a reason', async () => {
    const calls = serve(shown())
    renderAs('admin')
    fireEvent.click(await button('48 min'))
    await confirmWith('slower days')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/day-length'))?.body).toEqual({
        dayLengthMs: 48 * 60_000,
        reason: 'slower days'
      })
    )
  })

  it('changes the length of the day to an own number of minutes', async () => {
    const calls = serve(shown())
    renderAs('admin')
    const input = (await screen.findByLabelText('Own length in minutes')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.click(await button('Set the length'))
    await confirmWith('an hour and a half')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/day-length'))?.body).toEqual({
        dayLengthMs: 90 * 60_000,
        reason: 'an hour and a half'
      })
    )
  })

  it('sets the time of day', async () => {
    const calls = serve(shown())
    renderAs('admin')
    const picker = (await screen.findByLabelText('Time of day')) as HTMLInputElement
    fireEvent.mouseDown(picker)
    fireEvent.change(picker, { target: { value: '16:30' } })
    fireEvent.keyDown(picker, { key: 'Enter' })
    fireEvent.blur(picker)
    fireEvent.click(await button('Set the time'))
    await confirmWith('afternoon')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/time-of-day'))?.body).toEqual({
        minuteOfDay: 16 * 60 + 30,
        reason: 'afternoon'
      })
    )
  })

  it('shows the real-world time of a zone, and goes back to the cycle', async () => {
    const calls = serve(shown({ mode: 'realWorld', timeZone: 'Europe/Kyiv' }))
    renderAs('admin')
    fireEvent.mouseDown(await screen.findByRole('combobox'))
    fireEvent.click(await screen.findByText('UTC', { selector: '.ant-select-item-option-content' }))
    fireEvent.click(await button('Show this zone'))
    await confirmWith('sync to utc')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/real-world'))?.body).toEqual({
        timeZone: 'UTC',
        reason: 'sync to utc'
      })
    )
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    fireEvent.click(await button('Back to the day cycle'))
    await confirmWith('back to the cycle')
    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/cycle'))).toBe(true))
  })

  it('keeps the dialog when the server refuses', async () => {
    const calls = serve(shown(), (call) => (call.method === 'POST' ? { error: { status: 400, data: {} } } : undefined))
    renderAs('admin')
    fireEvent.click(await button('48 min'))
    await confirmWith('slower days')

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(dialog()).not.toBeNull()
  })

  it('closes the dialog on cancel without sending anything', async () => {
    const calls = serve(shown())
    renderAs('admin')
    fireEvent.click(await button('48 min'))
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 15000 })

    fireEvent.click(await button('Cancel'))

    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('offers to advance the clock to owners of a test server only', async () => {
    const calls = serve(shown())
    renderAs('owner')
    fireEvent.click(await button('+1 hour'))
    await confirmWith('finish the craft')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/advance-clock'))?.body).toEqual({
        stepMs: 3_600_000,
        reason: 'finish the craft'
      })
    )
  })

  it('does not offer the advance to an admin, or on a server that is not a test server', async () => {
    serve(shown())
    const admin = renderAs('admin')
    await screen.findByTestId('game-time-clock')
    expect(buttonsOf('+1 hour')).toHaveLength(0)
    admin.unmount()

    serve(shown({}, false))
    renderAs('owner')
    await screen.findByTestId('game-time-clock')
    expect(buttonsOf('+1 hour')).toHaveLength(0)
  })
})
