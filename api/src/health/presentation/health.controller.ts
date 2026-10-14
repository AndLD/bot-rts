import { Controller, Get } from '@nestjs/common'
import { ApiDefaultResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { SkipRateLimit } from '../../ratelimit/presentation/rate-limit.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { HealthResponse } from './health.response'
import { HealthService, HealthStatus } from '../application/health.service'

@ApiTags('health')
@ApiDefaultResponse({ type: ErrorResponseModel })
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @SkipRateLimit()
  @Get()
  @ApiOperation({ summary: 'Readiness: the database, Redis and the engine, each when the node uses it' })
  @ApiOkResponse({ type: HealthResponse })
  ready(): Promise<HealthStatus> {
    return this.health.ready()
  }

  @Public()
  @SkipRateLimit()
  @Get('live')
  @ApiOperation({ summary: 'Liveness: the process answers' })
  @ApiOkResponse({ type: HealthResponse })
  live(): HealthStatus {
    return this.health.live()
  }
}
