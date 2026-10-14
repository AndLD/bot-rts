import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, Matches } from 'class-validator'
import { IExecution } from '../../../../lib/utils/interfaces/executions'

export class StartExecutionDto {
  @IsString()
  @Length(1, 300)
  @Matches(/^\//, { message: 'file must be an absolute path like /memory-class1/main.js' })
  @ApiProperty({
    example: '/memory-class1/main.js',
    description: 'The script, as /<drive>/<path> on the drives of the bot'
  })
  file!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ApiPropertyOptional({ type: [String], description: 'Arguments of main(bot, ...args): strings, numbers or booleans' })
  args?: Array<string | number | boolean>
}

export class ExecutionResponse implements IExecution {
  @ApiProperty() id!: string
  @ApiProperty() botId!: string
  @ApiProperty() file!: string
  @ApiProperty({ type: [String] }) args!: readonly unknown[]
  @ApiProperty({ enum: ['queued', 'running', 'suspended', 'awaiting', 'finished', 'killed'] })
  state!: IExecution['state']
  @ApiProperty({ nullable: true, type: String }) reason!: string | null
  @ApiProperty() restarts!: number
}
