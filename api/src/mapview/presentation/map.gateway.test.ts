import { EventEmitter } from 'events'
import { Socket } from 'socket.io'
import { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { MapViewService } from '../application/map-view.service'
import { MapGateway } from './map.gateway'

function setup() {
  const view = { view: jest.fn().mockResolvedValue({ now: 1, cells: [], liveAreas: [] }) }
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const socket = Object.assign(new EventEmitter(), { principal: { user: { id: 'alice' } } })
  new MapGateway(view as unknown as MapViewService, logger).handleConnection(socket as unknown as Socket)
  const call = (...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit('get-map', ...args, (...ack: unknown[]) => resolve(ack))
    })

  return { view, call }
}

describe('MapGateway', () => {
  it("answers with the player's own view of the range", async () => {
    const { view, call } = setup()
    const range = { minX: 0, minY: 0, maxX: 5, maxY: 5 }

    expect(await call(range)).toEqual([{ now: 1, cells: [], liveAreas: [] }])
    expect(view.view).toHaveBeenCalledWith('alice', range)
  })

  it.each([undefined, null, 5])('rejects the range %p', async (range) => {
    const { call, view } = setup()

    expect(await call(range)).toEqual([null, { code: 400, msg: new ValidationError('Invalid map range').message }])
    expect(view.view).not.toHaveBeenCalled()
  })
})
