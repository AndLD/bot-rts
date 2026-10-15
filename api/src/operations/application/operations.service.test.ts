import { FakeClock } from '../../../tests/fakes/fakes'
import { IJobStatus, IMaintenanceBanner } from '../../../../lib/utils/admin-operations'
import { ControlState } from '../../engine/domain/engine-control'
import { EnginePort } from '../../engine/application/engine-port'
import { ValidationError } from '../../shared/domain/errors'
import { OperationsService } from './operations.service'

const banner: IMaintenanceBanner = {
  message: 'Maintenance at noon',
  startsAt: new Date('2026-06-01T12:00:00Z').getTime(),
  endsAt: null
}
const job: IJobStatus = { name: 'lifecycle', lastRunAt: 5, failures: 1, totals: { executionsDeleted: 3 } }

function setup({
  metrics = async () => ({ tick: 7, lastTickMs: 2, p95TickMs: 4, executions: 3, memoryBytes: 99, uptimeMs: 1234 }),
  top = async () => [
    { botId: 'b1', id: 'e1' },
    { botId: 'b1', id: 'e2' },
    { botId: 'b2', id: 'e3' }
  ],
  reboot = async (botId: string) => (botId === 'b1' ? [{}, {}] : [{}])
}: {
  metrics?: () => Promise<unknown>
  top?: () => Promise<unknown>
  reboot?: (botId: string) => Promise<unknown[]>
} = {}) {
  const clock = new FakeClock()
  let stored: IMaintenanceBanner | null = null
  const control: ControlState = { isPaused: false, areScriptsHalted: false, quarantined: [] }
  const announced: Array<[string[], string]> = []
  const pages = [['u1', 'u2'], ['u3'], []]
  const recipientCalls: Array<string | null> = []
  const service = new OperationsService(
    { metrics, top, reboot } as unknown as EnginePort,
    { load: async () => control, save: async () => undefined },
    { get: async () => stored, save: async (value) => void (stored = value) },
    { record: async () => undefined, list: async () => [job] },
    { read: async () => ({ isConfigured: true, finishedAt: 9, sizeBytes: null, location: null }) },
    {
      page: async (after) => {
        recipientCalls.push(after)
        return pages.shift() ?? []
      }
    },
    { announce: async (ids, text) => void announced.push([[...ids], text]) },
    clock
  )

  return { service, clock, control, announced, recipientCalls, stored: () => stored }
}

describe('OperationsService', () => {
  it('puts the engine, the control state, the jobs, the backup and the banner together', async () => {
    const { service, control } = setup()
    control.isPaused = true

    expect(await service.status()).toEqual({
      engine: {
        isResponding: true,
        uptimeMs: 1234,
        tick: 7,
        lastTickMs: 2,
        p95TickMs: 4,
        executions: 3,
        memoryBytes: 99
      },
      isPaused: true,
      areScriptsHalted: false,
      jobs: [job],
      backup: { isConfigured: true, finishedAt: 9, sizeBytes: null, location: null },
      banner: null
    })
  })

  it('says the engine does not respond instead of failing', async () => {
    const { service } = setup({
      metrics: async () => {
        throw new Error('timeout')
      }
    })

    expect((await service.status()).engine).toEqual({
      isResponding: false,
      uptimeMs: 0,
      tick: 0,
      lastTickMs: 0,
      p95TickMs: 0,
      executions: 0,
      memoryBytes: 0
    })
  })

  it('shows visitors the banner until its end, and whether the world is paused', async () => {
    const { service, clock, control } = setup()
    await service.setBanner({ ...banner, endsAt: clock.now().getTime() + 1000 })
    control.isPaused = true

    expect(await service.publicStatus()).toMatchObject({ isPaused: true, banner: { message: 'Maintenance at noon' } })
    clock.current = new Date(clock.now().getTime() + 1000)
    expect(await service.publicStatus()).toEqual({ isPaused: true, banner: null })
  })

  it('sets a trimmed banner and clears it, saying what changed', async () => {
    const { service, stored } = setup()

    const set = await service.setBanner({ ...banner, message: '  Maintenance at noon ' })
    expect(set).toEqual({ before: null, after: banner })
    expect(stored()).toEqual(banner)

    expect(await service.clearBanner()).toEqual({ before: banner, after: null })
    expect(stored()).toBeNull()
  })

  it('refuses a banner that cannot be shown, and stores nothing', async () => {
    const { service, stored } = setup()

    await expect(service.setBanner({ ...banner, message: '' })).rejects.toBeInstanceOf(ValidationError)
    expect(stored()).toBeNull()
  })

  it('announces to every page of players until there are none', async () => {
    const { service, announced, recipientCalls } = setup()

    const result = await service.announce('Hello')

    expect(result).toMatchObject({ recipients: 3, after: { text: 'Hello', recipients: 3 } })
    expect(announced).toEqual([
      [['u1', 'u2'], 'Hello'],
      [['u3'], 'Hello']
    ])
    expect(recipientCalls).toEqual([null, 'u2', 'u3'])
  })

  it('restarts the scripts bot by bot, counting the bots that cannot be restarted', async () => {
    const reboot = jest.fn(async (botId: string) => {
      if (botId === 'b2') throw new Error('quarantined')
      return [{}, {}]
    })
    const { service } = setup({ reboot })

    const result = await service.restartRuntime()

    expect(reboot.mock.calls).toEqual([['b1'], ['b2']])
    expect(result).toMatchObject({
      restarted: 2,
      failedBots: 1,
      before: { scripts: 3 },
      after: { restarted: 2, failedBots: 1 }
    })
  })
})
