import { Server } from 'socket.io'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { EngineEvent } from '../../engine/application/engine-ports'
import { GameEvent } from '../../engine/domain/game-event'
import { FakeClock } from '../../../tests/fakes/fakes'
import { Logger } from '../../shared/application/logger'
import { MapViewService } from '../application/map-view.service'
import { MapStreamer } from './map-streamer'

const cell = { x: 1, y: 2, z: 0 }
const moved = (userId: string, botId: string | null): GameEvent => ({
  type: 'BotMoved',
  at: 1,
  parties: [{ userId, botId }],
  from: { x: 1, y: 1, z: 0 },
  to: cell
})

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const engine = {
    onEvent: (l: (event: EngineEvent) => void) => {
      listener = l
      return off
    }
  }
  const compose = jest.fn().mockResolvedValue([{ x: 1, y: 2 }])
  const emitted: Array<{ room: string; event: string; payload: unknown }> = []
  const server = {
    to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }) })
  } as unknown as Server
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const streamer = new MapStreamer(engine as never, { compose } as unknown as MapViewService, new FakeClock(), logger)
  streamer.afterInit(server)
  const flush = () => new Promise((resolve) => setImmediate(resolve))

  return { streamer, compose, emitted, logger, off, emit: (e: EngineEvent) => listener(e), flush }
}

describe('MapStreamer', () => {
  it('sends the live batches of a player to that player as map cells', async () => {
    const { emit, compose, emitted, flush } = setup()

    emit({
      type: 'vision',
      userId: 'alice',
      botId: 'b',
      scannerId: 's',
      tick: 3,
      cells: [{ x: 1, y: 2, z: 0, type: MapPointType.RESOURCE, contentId: 'c', resource: null, seenAt: 9 }]
    })
    await flush()

    expect(compose).toHaveBeenCalledWith('alice', [
      expect.objectContaining({ location: expect.objectContaining({ x: 1, y: 2 }), seenAt: 9 })
    ])
    expect(emitted).toEqual([
      { room: 'user:alice', event: 'map-cells', payload: { now: expect.any(Number), cells: [{ x: 1, y: 2 }] } }
    ])
  })

  it('logs a batch it cannot compose', async () => {
    const { emit, compose, emitted, logger, flush } = setup()
    compose.mockRejectedValue(new Error('db'))

    emit({ type: 'vision', userId: 'alice', botId: 'b', scannerId: 's', tick: 3, cells: [] })
    await flush()

    expect(logger.error).toHaveBeenCalled()
    expect(emitted).toEqual([])
  })

  it('tells the player where the live areas are, and ignores other events', () => {
    const { emit, emitted } = setup()
    const areas = [{ scannerId: 's', botId: 'b', x: 1, y: 1, radius: 2 }]

    emit({ type: 'live-areas', userId: 'alice', areas })
    emit({ type: 'radio', userId: 'alice', changes: [] })

    expect(emitted).toEqual([{ room: 'user:alice', event: 'live-areas', payload: areas }])
  })

  it('moves the own bot on the map: the old cell empties, the new one holds the bot', async () => {
    const { streamer, compose, emitted } = setup()

    await streamer.consume('alice', moved('alice', 'b1'))

    const [, sightings] = compose.mock.calls[0]
    expect(sightings).toEqual([
      expect.objectContaining({ location: { x: 1, y: 1, z: 0 }, type: null }),
      expect.objectContaining({ location: cell, type: MapPointType.BOT, contentId: 'b1' })
    ])
    expect(emitted[0]).toMatchObject({ room: 'user:alice', event: 'map-cells' })
  })

  it('leaves the map alone for other players watching, other events and a party without a bot', async () => {
    const { streamer, compose } = setup()

    await streamer.consume('bob', moved('alice', 'b1'))
    await streamer.consume('alice', moved('alice', null))
    await streamer.consume('alice', { type: 'EnergyLow', at: 1, parties: [{ userId: 'alice', botId: 'b1' }] })

    expect(compose).not.toHaveBeenCalled()
  })

  it('says nothing before the server exists and stops listening on shutdown', async () => {
    const { off } = setup()
    const engine = { onEvent: () => off }
    const lone = new MapStreamer(
      engine as never,
      { compose: jest.fn().mockResolvedValue([]) } as unknown as MapViewService,
      new FakeClock(),
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    )

    await expect(lone.consume('alice', moved('alice', 'b1'))).resolves.toBeUndefined()
    lone.onApplicationShutdown()
    lone.afterInit({ to: jest.fn() } as unknown as Server)
    lone.onApplicationShutdown()

    expect(off).toHaveBeenCalledTimes(1)
  })
})
