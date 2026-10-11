import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class MaintenanceDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'The bot on an adjacent cell whose module is worked on' })
  targetBotId!: string

  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'The module to repair or take apart' })
  moduleId!: string
}
