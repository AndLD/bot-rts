import { ApiProperty } from '@nestjs/swagger'
import { HealthStatus } from '../application/health.service'

export class HealthResponse implements HealthStatus {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok'

  @ApiProperty({ enum: ['up'] })
  database!: 'up'
}
