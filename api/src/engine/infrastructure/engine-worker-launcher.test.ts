import { AppConfig } from '../../config/app-config'
import { spawnEngineWorker } from './engine-worker-launcher'

const constructed: Array<{ filename: string; options: { eval?: boolean; workerData: unknown } }> = []

jest.mock('worker_threads', () => ({
  Worker: class {
    constructor(filename: string, options: { eval?: boolean; workerData: unknown }) {
      constructed.push({ filename, options })
    }
  }
}))

const config = {
  databaseUrl: 'postgresql://x',
  worldSeed: undefined,
  engine: { isEnabled: false }
} as unknown as AppConfig

describe('spawnEngineWorker', () => {
  beforeEach(() => void (constructed.length = 0))

  it('runs the TypeScript entry through ts-node while the sources are TypeScript, with the config as plain data', () => {
    spawnEngineWorker(config, true)

    expect(constructed).toHaveLength(1)
    expect(constructed[0].filename).toContain("require('ts-node/register/transpile-only')")
    expect(constructed[0].filename).toContain('engine-worker.ts')
    expect(constructed[0].options).toEqual({
      eval: true,
      workerData: { databaseUrl: 'postgresql://x', engine: { isEnabled: false } }
    })
  })

  it('runs the built file when the server is compiled', () => {
    spawnEngineWorker(config, false)

    expect(constructed[0].filename).toMatch(/engine-worker\.js$/)
    expect(constructed[0].options).toEqual({
      workerData: { databaseUrl: 'postgresql://x', engine: { isEnabled: false } }
    })
  })
})
