import { Controller, Get } from '@nestjs/common'
import { ApiDefaultResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { HealthResponse } from './health.response'
import { HealthService, HealthStatus } from '../application/health.service'

@ApiTags('health')
@ApiDefaultResponse({ type: ErrorResponseModel })
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and database readiness' })
  @ApiOkResponse({ type: HealthResponse })
  check(): Promise<HealthStatus> {
    return this.health.check()
  }
}
