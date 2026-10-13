import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { api } from '../../shared/api'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GamePage from './GamePage'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../../shared/socket/SocketProvider', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

jest.mock('../map/GameMap', () => ({ __esModule: true, default: () => <div>the map</div> }))
jest.mock('../terminal/Terminal', () => ({ __esModule: true, default: () => <div>the terminal</div> }))

const query = jest.mocked(baseQueryWithRefresh)

function renderGame() {
  return renderApp(<GamePage />, { store: storeWithToken(makeJwt(60)) })
}

describe('GamePage', () => {
  beforeEach(() => {
    query.mockReset()
    // Whatever else the screen asks for (the tutorial) gets an empty answer
    query.mockResolvedValue({ data: null })
    localStorage.clear()
  })

  it('links to the account and waits for the bases', () => {
    query.mockReturnValue(new Promise(() => undefined) as never)

    renderGame()

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/bots', params: { type: 'base' } }),
      expect.anything(),
      undefined
    )
  })

  it('asks for nothing without a session', () => {
    renderApp(<GamePage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })

  it('offers to deploy a base to a player who has none', async () => {
    query.mockResolvedValue({ data: [] })

    renderGame()

    expect(await screen.findByRole('heading', { name: 'Deploy your base' })).toBeInTheDocument()
  })

  it('shows the terminal to a player with a base', async () => {
    query.mockResolvedValue({ data: [{ _id: 'b1', type: BOT_TYPE.BASE }] })

    renderGame()

    expect(await screen.findByText('the terminal')).toBeInTheDocument()
    expect(screen.getByText('the map')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Deploy your base' })).not.toBeInTheDocument()
  })

  it('shows the terminal once a base is deployed, without a reload', async () => {
    query.mockResolvedValueOnce({ data: [] })
    renderGame()
    await userEvent.click(await screen.findByText('Deploy base'))
    fireEvent.change(screen.getByLabelText('Base password'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: 'secret1' } })
    await userEvent.click(screen.getByText('Deploy base'))

    query.mockResolvedValueOnce({ data: {} }) // the deployment
    query.mockResolvedValueOnce({ data: [{ _id: 'b1', type: BOT_TYPE.BASE }] }) // the list, fetched again
    await userEvent.click(await screen.findByText('Deploy', { selector: '.ant-modal button span' }))

    expect(await screen.findByText('the terminal')).toBeInTheDocument()
  })

  it('keeps the game on screen when reading the bases again fails, as while the server restarts', async () => {
    const store = storeWithToken(makeJwt(60))
    const serving = (basesAnswer: object) =>
      query.mockImplementation((async (args: { url: string }) =>
        args.url === '/api/v1/bots' ? basesAnswer : { data: null }) as never)
    serving({ data: [{ _id: 'b1', type: BOT_TYPE.BASE }] })
    renderApp(<GamePage />, { store })
    expect(await screen.findByText('the terminal')).toBeInTheDocument()

    serving({ error: { status: 500, data: {} } })
    await act(async () => void store.dispatch(api.util.invalidateTags(['Bases'])))

    expect(screen.getByText('the terminal')).toBeInTheDocument()
    expect(screen.queryByText('Could not load your base')).not.toBeInTheDocument()
  })

  it('says so when the bases cannot be loaded', async () => {
    query.mockResolvedValue({ error: { status: 500, data: {} } })

    renderGame()

    expect(await screen.findByText('Could not load your base')).toBeInTheDocument()
  })
})
