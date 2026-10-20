import { fireEvent, screen, waitFor } from '@testing-library/react'
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

function setup(options: { global?: object; user?: object; reducedMotion?: boolean | null } = {}) {
  const patches: Array<{ url: string; body: unknown }> = []
  query.mockReset()
  query.mockImplementation((async (args: { url: string; method?: string; body?: unknown }) => {
    if (args.method === 'PATCH' || args.method === 'POST') {
      patches.push({ url: args.url, body: args.body })
      return { data: {} }
    }
    if (args.url.endsWith('/notifications/preferences')) {
      return { data: { categories: { attacks: true, damage: false } } }
    }
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
  it('has the notification switches of the player', async () => {
    setup()

    expect(await screen.findByLabelText('Notify about Attacks')).toBeChecked()
    expect(screen.getByLabelText('Notify about Damage and energy')).not.toBeChecked()
  })

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
    // The notification switches come from their own request, so they may or may not be there yet: count the categories only
    expect(screen.getAllByRole('switch').filter((element) => element.hasAttribute('data-category'))).toHaveLength(8)
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

  it('starts the tutorial again', async () => {
    const patches = setup()

    fireEvent.click(await screen.findByRole('button', { name: 'Show the tutorial again' }))

    await waitFor(() => expect(patches).toContainEqual({ url: '/api/v1/tutorial/restart', body: undefined }))
  })

  it('has no switches of the whole game: an admin sets them in the console', async () => {
    setup()
    await screen.findByText('Movement')

    expect(screen.queryByText('Game settings')).not.toBeInTheDocument()
  })
})
