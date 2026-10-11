import { AppError } from '../../shared/domain/app-error'
import { HealthProbe } from './health-probe'

export interface HealthStatus {
  status: 'ok'
  database: 'up'
}

export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, 'SERVICE_UNAVAILABLE', 'The database is not reachable')
  }
}

export class HealthService {
  constructor(private readonly probe: HealthProbe) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.probe.pingDatabase()
    } catch {
      throw new ServiceUnavailableError()
    }

    return { status: 'ok', database: 'up' }
  }
}
