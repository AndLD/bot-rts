import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { screen } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GamePage from './GamePage'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../../shared/socket/SocketProvider', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

jest.mock('../terminal/Terminal', () => ({ __esModule: true, default: () => <div>the terminal</div> }))

const query = jest.mocked(baseQueryWithRefresh)

function renderGame() {
  return renderApp(<GamePage />, { store: storeWithToken(makeJwt(60)) })
}

describe('GamePage', () => {
  beforeEach(() => {
    query.mockReset()
    localStorage.clear()
  })

  it('links to the account and waits for the bases', () => {
    query.mockReturnValue(new Promise(() => undefined) as never)

    renderGame()

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/bots?type=base' }),
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
    expect(screen.queryByRole('heading', { name: 'Deploy your base' })).not.toBeInTheDocument()
  })

  it('says so when the bases cannot be loaded', async () => {
    query.mockResolvedValue({ error: { status: 500, data: {} } })

    renderGame()

    expect(await screen.findByText('Could not load your base')).toBeInTheDocument()
  })
})
