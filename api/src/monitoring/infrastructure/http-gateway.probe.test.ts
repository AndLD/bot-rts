import { HttpGatewayProbe } from './http-gateway.probe'

const METRICS = `# HELP otelcol_exporter_queue_size Current size of the retry queue (in batches) [alpha]
# TYPE otelcol_exporter_queue_size gauge
otelcol_exporter_queue_size{data_type="logs",exporter="elasticsearch"} 3
otelcol_exporter_queue_size{data_type="traces",exporter="elasticsearch"} 4
otelcol_exporter_queue_capacity{data_type="logs",exporter="elasticsearch"} 10000
`

type Answer = { ok: boolean; body?: string } | Error

function probe(
  answers: Record<string, Answer>,
  urls: [string | undefined, string | undefined] = ['http://g/health', 'http://g/metrics']
) {
  const fetchImpl = jest.fn(async (url: string) => {
    const answer = answers[url]
    if (!answer || answer instanceof Error) throw answer ?? new Error('unreachable')
    return { ok: answer.ok, text: async () => answer.body ?? '' }
  })

  return new HttpGatewayProbe(urls[0], urls[1], 50, fetchImpl)
}

describe('HttpGatewayProbe', () => {
  it('is up when the health check answers, with the queue size summed over the exporters', async () => {
    const reading = await probe({
      'http://g/health': { ok: true, body: '{"status":"Server available"}' },
      'http://g/metrics': { ok: true, body: METRICS }
    }).read()

    expect(reading).toEqual({ isUp: true, queueSize: 7 })
  })

  it('is down, with no queue size, when it cannot be reached or answers with an error', async () => {
    expect(await probe({}).read()).toEqual({ isUp: false, queueSize: null })
    expect(await probe({ 'http://g/health': { ok: false }, 'http://g/metrics': { ok: false } }).read()).toEqual({
      isUp: false,
      queueSize: null
    })
  })

  it('has no queue size when the metrics have no queue in them', async () => {
    const reading = await probe({
      'http://g/health': { ok: true },
      'http://g/metrics': { ok: true, body: 'otelcol_process_uptime 5\n' }
    }).read()

    expect(reading).toEqual({ isUp: true, queueSize: null })
  })

  it('takes the metrics as the sign of life when there is no health address, and the health alone when there are no metrics', async () => {
    const answers = { 'http://g/health': { ok: true }, 'http://g/metrics': { ok: true, body: METRICS } }

    expect(await probe(answers, [undefined, 'http://g/metrics']).read()).toEqual({ isUp: true, queueSize: 7 })
    expect(await probe(answers, ['http://g/health', undefined]).read()).toEqual({ isUp: true, queueSize: null })
    expect(await probe({}, [undefined, 'http://g/metrics']).read()).toEqual({ isUp: false, queueSize: null })
  })

  it('gives up on a gateway that does not answer in time', async () => {
    const slow = new HttpGatewayProbe(
      'http://g/health',
      undefined,
      10,
      (_url, { signal }) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    )

    expect(await slow.read()).toEqual({ isUp: false, queueSize: null })
  })

  it('asks over the network by default', async () => {
    const real = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => METRICS } as Response)

    expect(await new HttpGatewayProbe(undefined, 'http://g/metrics', 50).read()).toEqual({ isUp: true, queueSize: 7 })
    real.mockRestore()
  })
})
