import { Prisma, PrismaClient } from '@prisma/client'
import {
  HistogramPoint,
  HistogramRow,
  MetricHistoryRepository,
  MinuteRow,
  ScalarPoint
} from '../application/metric-history.repository'

// The coarse tier of the monitoring history in PostgreSQL: a row per node, minute and metric, written once the minute is over
export class PrismaMetricHistoryRepository implements MetricHistoryRepository {
  constructor(private readonly client: PrismaClient) {}

  async saveMinutes(rows: readonly MinuteRow[]): Promise<void> {
    await this.client.metricMinute.createMany({ data: [...rows], skipDuplicates: true })
  }

  async saveHistograms(rows: readonly HistogramRow[]): Promise<void> {
    await this.client.histogramMinute.createMany({
      data: rows.map(({ node, minute, histogram, counts, slowestMs, slowestTraceId }) => ({
        node,
        minute,
        histogram,
        counts: [...counts],
        slowestMs,
        slowestTraceId
      })),
      skipDuplicates: true
    })
  }

  async readMinutes(
    metric: string,
    fromMs: number,
    toMs: number,
    stepMs: number,
    node?: string
  ): Promise<ScalarPoint[]> {
    const stepSeconds = stepMs / 1000
    const rows = await this.client.$queryRaw<Array<{ at: Date; sum: number; count: number }>>(Prisma.sql`
      SELECT to_timestamp(floor(extract(epoch FROM minute) / ${stepSeconds}) * ${stepSeconds}) AS at,
             SUM(sum) AS sum,
             SUM(count)::int AS count
        FROM metric_minutes
       WHERE metric = ${metric}
         AND minute >= ${new Date(fromMs)}
         AND minute <= ${new Date(toMs)}
         ${node === undefined ? Prisma.empty : Prisma.sql`AND node = ${node}`}
       GROUP BY 1
       ORDER BY 1`)

    return rows.map((row) => ({ at: row.at.getTime(), sum: Number(row.sum), count: Number(row.count) }))
  }

  async readHistograms(histogram: string, fromMs: number, toMs: number, node?: string): Promise<HistogramPoint[]> {
    const rows = await this.client.histogramMinute.findMany({
      where: {
        histogram,
        minute: { gte: new Date(fromMs), lte: new Date(toMs) },
        ...(node === undefined ? {} : { node })
      },
      orderBy: { minute: 'asc' }
    })

    return rows.map((row) => ({
      minute: row.minute.getTime(),
      counts: row.counts,
      slowestMs: row.slowestMs,
      slowestTraceId: row.slowestTraceId
    }))
  }

  async nodes(fromMs: number, toMs: number): Promise<string[]> {
    const rows = await this.client.metricMinute.findMany({
      where: { minute: { gte: new Date(fromMs), lte: new Date(toMs) } },
      distinct: ['node'],
      select: { node: true },
      orderBy: { node: 'asc' }
    })

    return rows.map((row) => row.node)
  }
}
