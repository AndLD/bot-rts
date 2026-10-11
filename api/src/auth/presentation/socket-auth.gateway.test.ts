import { Server } from 'socket.io'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { Logger } from '../../shared/application/logger'
import { SocketAuthGateway } from './socket-auth.gateway'

describe('SocketAuthGateway', () => {
  it('installs the handshake authentication on the server', () => {
    const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const gateway = new SocketAuthGateway(createAuthWorld().authService, logger)
    const server = { use: jest.fn() }

    gateway.afterInit(server as unknown as Server)

    expect(server.use).toHaveBeenCalledWith(expect.any(Function))
  })
})
