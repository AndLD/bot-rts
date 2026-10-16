import { statfs } from 'fs/promises'
import { FakeClock } from '../../../tests/fakes/fakes'
jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises')
  return { ...actual, statfs: jest.fn(actual.statfs) }
})

import { HostMetricSource, HostReaders, SYSTEM_HOST } from './host-metric.source'

function setup(backup = { isConfigured: true, finishedAt: null as number | null, sizeBytes: null, location: null }) {
  const clock = new FakeClock()
  const state = { cpu: 0, disk: { logs: 0.5 as number | null, data: 0.25 as number | null } }
  const host: HostReaders = {
    cpuMicros: () => state.cpu,
    loadAverage: () => 1.5,
    totalMemory: () => 1000,
    freeMemory: () => 250,
    cores: () => 4,
    diskUsedRatio: async (path) => (path === 'logs' ? state.disk.logs : state.disk.data)
  }
  const source = new HostMetricSource(host, { read: async () => backup }, clock, 'logs', 'data')

  return { source, state, clock, backup }
}

describe('HostMetricSource', () => {
  it('reports the load, the free memory and the disks, and the CPU from the second reading on', async () => {
    const { source, state, clock } = setup()

    const first = await source.read()
    state.cpu = 5_000_000
    clock.current = new Date(clock.current.getTime() + 10_000)
    const second = await source.read()

    expect(first.values).toEqual({
      'infrastructure.loadAverage': 1.5,
      'infrastructure.memoryFreeRatio': 0.25,
      'infrastructure.logDiskUsedRatio': 0.5,
      'infrastructure.dataDiskUsedRatio': 0.25
    })
    expect(second.values['infrastructure.cpuUsage']).toBe(0.5)
  })

  it('leaves out a disk it cannot read', async () => {
    const { source, state } = setup()
    state.disk.logs = null

    const { values } = await source.read()

    expect(values).not.toHaveProperty('infrastructure.logDiskUsedRatio')
    expect(values['infrastructure.dataDiskUsedRatio']).toBe(0.25)
  })

  it('tells the age of the last backup, and says nothing when no backup has reported', async () => {
    const now = new FakeClock().now().getTime()
    const known = await setup({
      isConfigured: true,
      finishedAt: now - 7200_000,
      sizeBytes: null,
      location: null
    }).source.read()
    const future = await setup({
      isConfigured: true,
      finishedAt: now + 5000,
      sizeBytes: null,
      location: null
    }).source.read()
    const unknown = await setup().source.read()

    expect(known.values['infrastructure.backupAgeSeconds']).toBe(7200)
    expect(future.values['infrastructure.backupAgeSeconds']).toBe(0)
    expect(unknown.values).not.toHaveProperty('infrastructure.backupAgeSeconds')
  })

  it('reads the real machine', async () => {
    expect(SYSTEM_HOST.cpuMicros()).toBeGreaterThan(0)
    expect(SYSTEM_HOST.loadAverage()).toBeGreaterThanOrEqual(0)
    expect(SYSTEM_HOST.totalMemory()).toBeGreaterThan(SYSTEM_HOST.freeMemory() - 1)
    expect(SYSTEM_HOST.cores()).toBeGreaterThan(0)
    expect(await SYSTEM_HOST.diskUsedRatio('.')).toBeGreaterThan(0)
    expect(await SYSTEM_HOST.diskUsedRatio('/definitely/not/here')).toBeNull()
  })

  it('reports no disk share for a volume with no blocks', async () => {
    ;(statfs as jest.Mock).mockResolvedValueOnce({ blocks: 0, bavail: 0 })

    expect(await SYSTEM_HOST.diskUsedRatio('.')).toBeNull()
  })

  it('reports no CPU use when the clock has not moved between two readings', async () => {
    const { source } = setup()

    await source.read()
    const { values } = await source.read()

    expect(values).not.toHaveProperty('infrastructure.cpuUsage')
  })
})
