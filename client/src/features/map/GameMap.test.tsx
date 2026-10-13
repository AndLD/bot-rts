import { screen } from '@testing-library/react'
import { DEFAULT_GAME_TIME } from '@lib/utils/game-time'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GameMap from './GameMap'
import { TileLoader } from './TileLoader'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const canvas = jest.fn()
const reduced = jest.fn()
jest.mock('./MapCanvas', () => ({
  __esModule: true,
  default: (props: {
    center?: { x: number; y: number }
    onOpenBot?: unknown
    isReducedMotion?: boolean
    children?: React.ReactNode
  }) => {
    canvas(props.center, props.onOpenBot)
    reduced(props.isReducedMotion)
    return <div>the map{props.children}</div>
  }
}))

describe('GameMap', () => {
  it('lays the night filter over the map, as strong as the time of day says', async () => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.endsWith('/time')
          ? { data: { now: 2 * 60_000, config: DEFAULT_GAME_TIME } }
          : args.url.endsWith('/settings')
            ? { data: { user: { reducedMotion: null } } }
            : args.url.includes('/map/bots/')
              ? { data: { x: 1, y: 1 } }
              : { data: [] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    await jest
      .requireActual('@testing-library/react')
      .waitFor(() => expect(screen.getByTestId('night-filter')).toHaveStyle({ opacity: '0.65' }))
  })

  it('opens the map on the base', async () => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.includes('/map/bots/')
          ? { data: { x: 7, y: 8 } }
          : args.url.endsWith('/settings')
            ? { data: { user: { reducedMotion: null } } }
            : { data: [{ _id: 'b1' }] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.getByText('the map')).toBeInTheDocument()
    await screen.findByText('the map')
    expect(jest.mocked(baseQueryWithRefresh)).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/map/bots/b1' }),
      expect.anything(),
      undefined
    )
    await jest
      .requireActual('@testing-library/react')
      .waitFor(() => expect(canvas).toHaveBeenCalledWith({ x: 7, y: 8 }, undefined))
  })

  it('asks for the map again when the number of bots changes', async () => {
    const invalidate = jest.spyOn(TileLoader.prototype, 'invalidate')
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.includes('/map/bots/')
          ? { data: { x: 1, y: 1 } }
          : args.url.endsWith('/settings')
            ? { data: { user: { reducedMotion: null } } }
            : { data: [{ _id: 'b1' }, { _id: 'b2' }] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    await jest.requireActual('@testing-library/react').waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2))
    invalidate.mockRestore()
  })

  it.each([
    [true, true],
    [false, false]
  ])('tells the map whether motion is reduced (setting %p)', async (reducedMotion, expected) => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.endsWith('/settings')
          ? { data: { user: { reducedMotion } } }
          : args.url.includes('/map/bots/')
            ? { data: { x: 1, y: 1 } }
            : { data: [] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    await jest.requireActual('@testing-library/react').waitFor(() => expect(reduced).toHaveBeenLastCalledWith(expected))
  })
})
