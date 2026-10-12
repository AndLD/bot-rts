import { screen, within } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import ControlPanel from './ControlPanel'

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
const part = (type: string, name = type) => ({ _id: `m-${type}`, botId: 'b1', type, name })

function setup(modules: object[], effective: object = {}) {
  query.mockReset()
  query.mockImplementation((async (args: { url: string }) =>
    args.url.endsWith('/modules')
      ? { data: modules }
      : {
          data: {
            global: { categories: on },
            user: { categories: on, reducedMotion: null },
            effective: { ...on, ...effective }
          }
        }) as never)

  return renderApp(<ControlPanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })
}

describe('ControlPanel', () => {
  it('waits for the bot, and says when it cannot be loaded', async () => {
    query.mockReset()
    query.mockReturnValue(new Promise(() => undefined) as never)
    const { unmount } = renderApp(<ControlPanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    unmount()

    query.mockReset()
    query.mockResolvedValue({ error: { status: 500, data: {} } })
    renderApp(<ControlPanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })
    expect(await screen.findByText('Could not load the bot')).toBeInTheDocument()
  })

  it('lists the actions the modules of the bot grant, in categories', async () => {
    setup([part('scanner'), part('engine'), part('movement'), part('weapon')])

    expect(await screen.findByText('Observation')).toBeInTheDocument()
    expect(screen.getByText('Movement')).toBeInTheDocument()
    expect(screen.getByText('Combat')).toBeInTheDocument()
    expect(screen.queryByText('Extraction')).not.toBeInTheDocument()
    for (const name of ['scan', 'move', 'turn', 'aim', 'shoot', 'reload']) {
      expect(screen.getByRole('button', { name: `Do ${name}` })).toBeEnabled()
    }
    expect(screen.queryByRole('button', { name: 'Do drop' })).not.toBeInTheDocument()
  })

  it('shows a category that is switched off, and cannot use it', async () => {
    setup([part('scanner'), part('engine'), part('movement')], { movement: false })
    const section = (await screen.findByText('Movement')).closest('section') as HTMLElement

    expect(within(section).getByText('switched off')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Do move' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Do scan' })).toBeEnabled()
  })
})
