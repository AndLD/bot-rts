import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

// The gateway collector and Elasticsearch of docker-compose.yml (`npm run obs:up`), as the integration tests reach them
export const GATEWAY = process.env.OTEL_GATEWAY_URL ?? 'http://localhost:4318'
export const HEALTH = process.env.OTEL_GATEWAY_HEALTH_URL ?? 'http://localhost:13133'
export const METRICS = process.env.OTEL_GATEWAY_METRICS_URL ?? 'http://localhost:8888/metrics'
export const ELASTICSEARCH = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200'
export const TOKEN = process.env.OTEL_GATEWAY_TOKEN ?? 'botrts-dev-gateway-token'

// Whether the gateway and Elasticsearch run here. CI starts them and sets REQUIRE_OBSERVABILITY, so a missing one fails there; on a
// developer's machine without them the tests say so and pass.
export async function isObservabilityUp(): Promise<boolean> {
  try {
    return (await fetch(HEALTH)).ok && (await fetch(`${ELASTICSEARCH}/_cluster/health`)).ok
  } catch {
    return false
  }
}

export function skipOrFail(isUp: boolean): void {
  if (!isUp && process.env.REQUIRE_OBSERVABILITY) {
    throw new Error('The gateway collector and Elasticsearch are required: run `npm run obs:up`')
  }
}

export function warnSkipped(): void {
  console.warn('Skipped: the gateway collector and Elasticsearch are not running (`npm run obs:up`)')
}

// A node of its own, in its own process: sends one span with a child and one log record, and returns the trace it wrote in
export async function emit(message: string, node: { service?: string; traceparent?: string } = {}) {
  const { stderr } = await run(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', 'tests/integration/emit-telemetry.ts', message],
    {
      env: {
        ...process.env,
        OTEL_EXPORTER_OTLP_ENDPOINT: GATEWAY,
        EMIT_AUTHORIZATION: `Bearer ${TOKEN}`,
        ...(node.service ? { EMIT_SERVICE: node.service } : {}),
        ...(node.traceparent ? { EMIT_TRACEPARENT: node.traceparent } : {})
      }
    }
  )

  return JSON.parse(stderr.trim().split('\n').pop() as string) as { traceId: string; traceparent: string }
}
