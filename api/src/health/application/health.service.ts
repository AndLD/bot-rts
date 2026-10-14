import { AppError } from '../../shared/domain/app-error'
import { Component, HealthCheck } from './health-check'

export type HealthStatus = { status: 'ok' } & Partial<Record<Component, 'up'>>

export class ServiceUnavailableError extends AppError {
  constructor(readonly down: Component[]) {
    super(503, 'SERVICE_UNAVAILABLE', `Not reachable: ${down.join(', ')}`)
  }
}

// A check that does not answer in this long counts as down
const CHECK_TIMEOUT_MS = 2000

function withTimeout(promise: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export class HealthService {
  constructor(private readonly checks: readonly HealthCheck[]) {}

  // Liveness: the process answers. It touches no dependency, so a restart is never asked for because PostgreSQL is down.
  live(): HealthStatus {
    return { status: 'ok' }
  }

  // Readiness: every dependency the node uses answers; the load balancer takes a node out of rotation when it does not
  async ready(): Promise<HealthStatus> {
    const outcomes = await Promise.all(
      this.checks.map((check) =>
        withTimeout(check.check()).then(
          () => ({ component: check.component, isUp: true }),
          () => ({ component: check.component, isUp: false })
        )
      )
    )
    const down = outcomes.filter((outcome) => !outcome.isUp).map((outcome) => outcome.component)

    if (down.length) {
      throw new ServiceUnavailableError(down)
    }

    return { status: 'ok', ...Object.fromEntries(outcomes.map((outcome) => [outcome.component, 'up'])) }
  }
}
