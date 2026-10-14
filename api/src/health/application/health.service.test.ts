import { HealthCheck } from './health-check'
import { HealthService, ServiceUnavailableError } from './health.service'

const check = (component: HealthCheck['component'], outcome: () => Promise<void>): HealthCheck => ({
  component,
  check: outcome
})

describe('HealthService', () => {
  it('is alive without asking any dependency', () => {
    const database = check('database', jest.fn())

    expect(new HealthService([database]).live()).toEqual({ status: 'ok' })
    expect(database.check).not.toHaveBeenCalled()
  })

  it('is ready when every dependency answers', async () => {
    const service = new HealthService([
      check('database', async () => undefined),
      check('redis', async () => undefined),
      check('engine', async () => undefined)
    ])

    expect(await service.ready()).toEqual({ status: 'ok', database: 'up', redis: 'up', engine: 'up' })
  })

  it('names every dependency that is down in the 503', async () => {
    const service = new HealthService([
      check('database', () => Promise.reject(new Error('ECONNREFUSED'))),
      check('redis', async () => undefined),
      check('engine', () => Promise.reject(new Error('down')))
    ])

    await expect(service.ready()).rejects.toThrow(ServiceUnavailableError)
    await expect(service.ready()).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Not reachable: database, engine',
      down: ['database', 'engine']
    })
  })

  it('counts a dependency that does not answer in time as down', async () => {
    jest.useFakeTimers()
    const service = new HealthService([check('redis', () => new Promise(() => undefined))])
    const outcome = expect(service.ready()).rejects.toMatchObject({ down: ['redis'] })

    await jest.advanceTimersByTimeAsync(2500)
    await outcome
    jest.useRealTimers()
  })
})
