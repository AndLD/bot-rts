import { ApiProperty } from '@nestjs/swagger'
import { HealthStatus } from '../application/health.service'

export class HealthResponse implements HealthStatus {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok'

  @ApiProperty({ enum: ['up'], required: false })
  database?: 'up'

  @ApiProperty({ enum: ['up'], required: false, description: 'Present when Redis is configured' })
  redis?: 'up'

  @ApiProperty({ enum: ['up'], required: false, description: 'Present when the node uses the engine' })
  engine?: 'up'
}
