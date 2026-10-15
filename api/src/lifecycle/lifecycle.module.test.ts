import { LifecycleModule } from './lifecycle.module'

describe('LifecycleModule', () => {
  afterEach(() => jest.useRealTimers())

  function setup(isEnabled: boolean, role = 'all') {
    jest.useFakeTimers()
    const service = { runOnce: jest.fn(async () => ({})), intervalMs: jest.fn(() => 500) }
    const collectors = { register: jest.fn() }
    const module = new LifecycleModule(
      service as never,
      { isEnabled, intervalMs: 1000 } as never,
      { deployment: { role } } as never,
      {} as never,
      collectors as never
    )

    return { module, service, collectors }
  }

  it('registers its metrics, and runs the job after the first delay and then at the interval in force', async () => {
    const { module, service, collectors } = setup(true)
    module.onModuleInit()
    module.onApplicationBootstrap()

    await jest.advanceTimersByTimeAsync(60_000)
    expect(service.runOnce).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(500)

    expect(service.intervalMs).toHaveBeenCalledWith(1000)
    expect(service.runOnce).toHaveBeenCalledTimes(2)
    expect(collectors.register).toHaveBeenCalledTimes(1)
    module.onApplicationShutdown()
  })

  it.each([
    [false, 'all'],
    [true, 'api']
  ])('does not schedule the job when enabled is %s on a node with the role %s', async (isEnabled, role) => {
    const { module, service } = setup(isEnabled, role)
    module.onApplicationBootstrap()

    await jest.advanceTimersByTimeAsync(120_000)

    expect(service.runOnce).not.toHaveBeenCalled()
    module.onApplicationShutdown()
  })
})
