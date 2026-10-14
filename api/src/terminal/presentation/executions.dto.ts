import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import { IExecution } from '../../../../lib/utils/interfaces/executions'
import { ITerminalLogEntry, TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'

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

export class TerminalHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 1000, description: 'How many of the newest lines' })
  limit?: number
}

export class TerminalLogEntryResponse implements ITerminalLogEntry {
  @ApiProperty() _id!: string
  @ApiProperty() sessionId!: string
  @ApiProperty() botId!: string
  @ApiProperty() at!: number
  @ApiProperty({ enum: Object.values(TERMINAL_LOG_KIND) }) kind!: TERMINAL_LOG_KIND
  @ApiProperty() text!: string
}
