import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { EnginePort } from '../../engine/application/engine-port'
import { EngineHealthCheck } from './engine-health-check'
import { PrismaHealthCheck } from './prisma-health-check'
import { RedisHealthCheck } from './redis-health-check'

describe('the health checks', () => {
  it('ask the database with a trivial query', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }])
    const check = new PrismaHealthCheck({ $queryRaw: queryRaw } as unknown as PrismaClient)

    await expect(check.check()).resolves.toBeUndefined()
    expect(check.component).toBe('database')
    expect(queryRaw).toHaveBeenCalled()
  })

  it('ping Redis', async () => {
    const ping = jest.fn().mockResolvedValue('PONG')
    const check = new RedisHealthCheck({ ping } as unknown as Redis)

    await check.check()
    expect(check.component).toBe('redis')
    expect(ping).toHaveBeenCalled()
  })

  it('ask the engine for its numbers', async () => {
    const metrics = jest.fn().mockResolvedValue({})
    const check = new EngineHealthCheck({ metrics } as unknown as EnginePort)

    await check.check()
    expect(check.component).toBe('engine')
    expect(metrics).toHaveBeenCalled()
  })
})
