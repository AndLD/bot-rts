import { screen } from '@testing-library/react'
import { notification } from 'antd'
import { SocketContext } from '../../shared/socket/socket-context'
import { DEFAULT_GAME_TIME } from '@lib/utils/game-time'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GameClock from './GameClock'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const MINUTE = 60_000

function serverSays(now: number | null) {
  jest
    .mocked(baseQueryWithRefresh)
    .mockImplementation((async () =>
      now === null ? { error: { status: 500 } } : { data: { now, config: DEFAULT_GAME_TIME } }) as never)
}

describe('GameClock', () => {
  it('shows nothing until the server has said the time', () => {
    serverSays(null)

    renderApp(<GameClock />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.queryByTestId('game-clock')).not.toBeInTheDocument()
  })

  it('shows the in-game time and the part of the day', async () => {
    serverSays(12.5 * MINUTE)

    renderApp(<GameClock />, { store: storeWithToken(makeJwt(60)) })

    expect(await screen.findByTestId('game-clock')).toHaveTextContent(/^12:\d\d · Day$/)
  })

  it('names the night', async () => {
    serverSays(2.5 * MINUTE)

    renderApp(<GameClock />, { store: storeWithToken(makeJwt(60)) })

    expect(await screen.findByText(/02:\d\d · Night/)).toBeInTheDocument()
  })

  it('tells the player when an admin changes the time of the game, and stops listening when it goes away', () => {
    serverSays(null)
    const info = jest.spyOn(notification, 'info').mockImplementation(() => undefined)
    const handlers: Record<string, () => void> = {}
    const socket = {
      on: jest.fn((event: string, handler: () => void) => void (handlers[event] = handler)),
      off: jest.fn()
    }
    const view = renderApp(
      <SocketContext.Provider value={socket as never}>
        <GameClock />
      </SocketContext.Provider>,
      { store: storeWithToken(makeJwt(60)) }
    )

    handlers['game-time-changed']()
    expect(info).toHaveBeenCalledWith({ message: 'The time of the game was changed by an admin.' })
    view.unmount()
    expect(socket.off).toHaveBeenCalledWith('game-time-changed', handlers['game-time-changed'])
    info.mockRestore()
  })
})
