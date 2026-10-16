import { statfs } from 'fs/promises'
import { cpus, freemem, loadavg, totalmem } from 'os'
import { BackupStatusReader } from '../../operations/application/ports'
import { Clock } from '../../shared/application/clock'
import { MetricReading, MetricSource } from '../application/ports'

export interface HostReaders {
  cpuMicros(): number
  loadAverage(): number
  totalMemory(): number
  freeMemory(): number
  cores(): number
  // Used share of the volume that holds a path; null when it cannot be read
  diskUsedRatio(path: string): Promise<number | null>
}

export const SYSTEM_HOST: HostReaders = {
  cpuMicros: () => {
    const { user, system } = process.cpuUsage()
    return user + system
  },
  loadAverage: () => loadavg()[0],
  totalMemory: totalmem,
  freeMemory: freemem,
  cores: () => cpus().length,
  diskUsedRatio: async (path) => {
    try {
      const { blocks, bavail } = await statfs(path)
      return blocks > 0 ? 1 - bavail / blocks : null
    } catch {
      return null
    }
  }
}

// The machine of this node (design §25.5, Infrastructure): the CPU the process uses, the load, the free memory, the disk the logs and the
// data are on, and how old the last backup is (unknown when no backup has reported)
export class HostMetricSource implements MetricSource {
  private previous: { atMs: number; cpuMicros: number } | null = null

  constructor(
    private readonly host: HostReaders,
    private readonly backup: BackupStatusReader,
    private readonly clock: Clock,
    private readonly logPath: string,
    private readonly dataPath: string
  ) {}

  async read(): Promise<MetricReading> {
    const atMs = this.clock.now().getTime()
    const cpuMicros = this.host.cpuMicros()
    const values: Record<string, number> = {
      'infrastructure.loadAverage': this.host.loadAverage(),
      'infrastructure.memoryFreeRatio': this.host.freeMemory() / this.host.totalMemory()
    }

    if (this.previous && atMs > this.previous.atMs) {
      // Seconds of CPU per second of time, over all the cores of the process: 1 is one core fully used
      values['infrastructure.cpuUsage'] = (cpuMicros - this.previous.cpuMicros) / ((atMs - this.previous.atMs) * 1000)
    }
    this.previous = { atMs, cpuMicros }
    for (const [metric, path] of [
      ['infrastructure.logDiskUsedRatio', this.logPath],
      ['infrastructure.dataDiskUsedRatio', this.dataPath]
    ] as const) {
      const used = await this.host.diskUsedRatio(path)
      if (used !== null) {
        values[metric] = used
      }
    }
    const { finishedAt } = await this.backup.read()
    if (finishedAt !== null) {
      values['infrastructure.backupAgeSeconds'] = Math.max(0, (atMs - finishedAt) / 1000)
    }

    return { values }
  }
}
