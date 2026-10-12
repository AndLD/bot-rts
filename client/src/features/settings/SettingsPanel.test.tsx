import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import SettingsPanel from './SettingsPanel'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const on = {
  movement: true,
  combat: true,
  extraction: true,
  logistics: true,
  fabrication: true,
  maintenance: true,
  communication: true,
  trade: true
}

function setup(options: { status?: string; global?: object; user?: object; reducedMotion?: boolean | null } = {}) {
  const patches: Array<{ url: string; body: unknown }> = []
  query.mockReset()
  query.mockImplementation((async (args: { url: string; method?: string; body?: unknown }) => {
    if (args.method === 'PATCH') {
      patches.push({ url: args.url, body: args.body })
      return { data: {} }
    }
    if (args.url.endsWith('/users/me')) return { data: { status: options.status ?? 'user' } }
    return {
      data: {
        global: { categories: { ...on, ...options.global } },
        user: { categories: { ...on, ...options.user }, reducedMotion: options.reducedMotion ?? null },
        effective: on
      }
    }
  }) as never)
  renderApp(<SettingsPanel />, { store: storeWithToken(makeJwt(60)) })

  return patches
}

const switchOf = (name: string) => screen.getByLabelText(name)

describe('SettingsPanel', () => {
  it('waits for the settings, and says when they cannot be loaded', async () => {
    query.mockReset()
    query.mockReturnValue(new Promise(() => undefined) as never)
    const { unmount } = renderApp(<SettingsPanel />, { store: storeWithToken(makeJwt(60)) })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    unmount()

    query.mockReset()
    query.mockResolvedValue({ error: { status: 500, data: {} } })
    renderApp(<SettingsPanel />, { store: storeWithToken(makeJwt(60)) })
    expect(await screen.findByText('Could not load the settings')).toBeInTheDocument()
  })

  it('shows the eight categories as the player has them, and marks what the game switched off', async () => {
    setup({ user: { combat: false }, global: { trade: false } })

    expect(await screen.findByText('Movement')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(8)
    expect(switchOf('Combat')).not.toBeChecked()
    expect(switchOf('Movement')).toBeChecked()
    expect(screen.getByText('off in the game')).toBeInTheDocument()
  })

  it('switches a category off for the player', async () => {
    const patches = setup()
    fireEvent.click(await screen.findByLabelText('Fabrication'))

    await waitFor(() =>
      expect(patches).toContainEqual({ url: '/api/v1/settings', body: { categories: { fabrication: false } } })
    )
  })

  it.each([
    ['As in the system', null],
    ['Reduced', true],
    ['Full', false]
  ])('chooses %s motion', async (label, reducedMotion) => {
    // Starts with a setting that differs from the choice, so that choosing it is a change
    const patches = setup({ reducedMotion: reducedMotion === null ? true : null })
    await screen.findByRole('combobox', { name: 'Motion' })

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Motion' }))
    fireEvent.click(await screen.findByText(label, { selector: '.ant-select-item-option-content' }))

    await waitFor(() => expect(patches).toContainEqual({ url: '/api/v1/settings', body: { reducedMotion } }))
  })

  it.each([
    [null, 'As in the system'],
    [true, 'Reduced'],
    [false, 'Full']
  ])('shows the motion setting %p', async (reducedMotion, label) => {
    setup({ reducedMotion })

    expect(
      await screen.findByText(label, { selector: '.ant-select-content-value, .ant-select-selection-item' })
    ).toBeInTheDocument()
  })

  it('shows the game settings to an admin only, and changes them', async () => {
    const patches = setup({ status: 'admin' })
    const game = (await screen.findByText('Game settings')).parentElement as HTMLElement

    fireEvent.click(within(game).getByLabelText('Game: Combat'))

    await waitFor(() =>
      expect(patches).toContainEqual({ url: '/api/v1/admin/settings', body: { categories: { combat: false } } })
    )
  })

  it('keeps the game settings from a regular player', async () => {
    setup()
    await screen.findByText('Movement')

    expect(screen.queryByText('Game settings')).not.toBeInTheDocument()
  })
})
