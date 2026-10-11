import { HealthService, ServiceUnavailableError } from './health.service'

describe('HealthService', () => {
  it('reports a reachable database', async () => {
    const service = new HealthService({ pingDatabase: jest.fn().mockResolvedValue(undefined) })

    expect(await service.check()).toEqual({ status: 'ok', database: 'up' })
  })

  it('turns a failing probe into a 503', async () => {
    const service = new HealthService({ pingDatabase: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) })

    await expect(service.check()).rejects.toThrow(ServiceUnavailableError)
    await expect(service.check()).rejects.toMatchObject({ statusCode: 503, code: 'SERVICE_UNAVAILABLE' })
  })
})
