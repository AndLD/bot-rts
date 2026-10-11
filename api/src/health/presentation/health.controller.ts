import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { HealthService, HealthStatus } from '../application/health.service'

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and database readiness' })
  check(): Promise<HealthStatus> {
    return this.health.check()
  }
}
