import { RedisConnections } from './redis.module'

describe('RedisConnections', () => {
  it('has no connector without a Redis address', () => {
    expect(new RedisConnections(undefined).connector).toBeNull()
  })

  it('closes every connection it opened, disconnecting one that cannot quit cleanly', async () => {
    const connections = new RedisConnections('redis://localhost:6379')
    const connect = connections.connector as () => import('ioredis').default
    const clean = connect()
    await clean.ping()
    const quit = jest.spyOn(clean, 'quit')
    const stubborn = connect()
    jest.spyOn(stubborn, 'quit').mockRejectedValueOnce(new Error('already closed'))
    const disconnect = jest.spyOn(stubborn, 'disconnect')

    await connections.closeAll()

    expect(quit).toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalled()
  })
})
