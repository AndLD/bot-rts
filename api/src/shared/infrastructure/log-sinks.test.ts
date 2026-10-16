import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { testTelemetry } from '../../../tests/fakes/telemetry'
import { LogRecord } from './log-format'
import { ConsoleLogSink, FileLogSink, OtlpLogSink } from './log-sinks'

const record: LogRecord = {
  time: new Date('2026-10-16T10:00:00.000Z'),
  level: 'warn',
  category: 'app',
  message: 'careful',
  traceId: undefined,
  spanId: undefined,
  requestId: 'req-1'
}

describe('ConsoleLogSink', () => {
  it('writes one line', () => {
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

    new ConsoleLogSink('text').write(record)

    expect(stdout).toHaveBeenCalledWith('2026-10-16T10:00:00.000Z [WARN] app [req-1] - careful\n')
    stdout.mockRestore()
  })
})

describe('FileLogSink', () => {
  it('creates its file with the first record, named after the start, and closes it', async () => {
    const directory = join(mkdtempSync(join(tmpdir(), 'botrts-sink-')), 'logs')
    const sink = new FileLogSink('text', directory, new Date('2026-10-16T09:30:00.123Z'))

    await sink.close()
    expect(existsSync(directory)).toBe(false)
    sink.write(record)
    sink.write({ ...record, message: 'again' })
    await sink.close()

    expect(readdirSync(directory)).toEqual(['2026-10-16T09-30-00-123Z.log'])
    expect(readFileSync(join(directory, '2026-10-16T09-30-00-123Z.log'), 'utf8').split('\n')).toEqual([
      '2026-10-16T10:00:00.000Z [WARN] app [req-1] - careful',
      '2026-10-16T10:00:00.000Z [WARN] app [req-1] - again',
      ''
    ])
    rmSync(join(directory, '..'), { recursive: true })
  })
})

describe('OtlpLogSink', () => {
  it('emits the record with its severity and, inside a span, the ids of the span', () => {
    const exporter = new InMemoryLogRecordExporter()
    const provider = new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] })
    const sink = new OtlpLogSink(provider.getLogger('test'))
    const { telemetry } = testTelemetry()

    sink.write(record)
    telemetry.tracing.withSpan('work', {}, (span) => {
      sink.write({ ...record, level: 'error', requestId: undefined })
      const [, inside] = exporter.getFinishedLogRecords()
      expect(inside.spanContext?.traceId).toBe(span.context?.traceId)
    })

    const [outside, inside] = exporter.getFinishedLogRecords()
    expect(outside).toMatchObject({
      severityText: 'WARN',
      severityNumber: 13,
      body: 'careful',
      attributes: { 'log.category': 'app', 'botrts.request_id': 'req-1' }
    })
    expect(inside).toMatchObject({ severityText: 'ERROR', severityNumber: 17 })
    expect(inside.attributes['botrts.request_id']).toBeUndefined()
  })
})
