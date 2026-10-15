import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Allow, IsObject, IsOptional, IsString, Length } from 'class-validator'
import {
  IRetention,
  IRetentionJob,
  RETENTION_JOBS,
  RetentionJob,
  RetentionValues
} from '../../../../../lib/utils/admin-retention'

export class RetentionJobResponse implements IRetentionJob {
  @ApiProperty({ enum: RETENTION_JOBS })
  job!: RetentionJob

  @ApiProperty({ type: 'object', additionalProperties: { oneOf: [{ type: 'number' }, { type: 'boolean' }] } })
  values!: RetentionValues

  @ApiProperty({ type: 'object', additionalProperties: { oneOf: [{ type: 'number' }, { type: 'boolean' }] } })
  defaults!: RetentionValues

  @ApiProperty()
  isOverridden!: boolean

  @ApiProperty({ type: Number, nullable: true })
  lastRemoved!: number | null
}

export class RetentionResponse implements IRetention {
  @ApiProperty({ type: [RetentionJobResponse] })
  jobs!: RetentionJobResponse[]

  @ApiProperty({ type: Number, nullable: true })
  lastRunAt!: number | null

  @ApiProperty()
  hasFailures!: boolean

  @ApiProperty({ type: Number, nullable: true })
  updatedAt!: number | null
}

export class ReasonOnlyDto {
  @IsString()
  @Length(3, 500)
  @ApiProperty({ minLength: 3, maxLength: 500 })
  reason!: string
}

export class UpdateRetentionDto extends ReasonOnlyDto {
  @IsObject()
  @Allow()
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { oneOf: [{ type: 'number' }, { type: 'boolean' }] }
    },
    description: 'The jobs to change, each with the fields to set'
  })
  jobs!: Record<string, Record<string, unknown>>

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'The typed word that confirms switching on the erasure of inactive accounts' })
  confirmation?: string
}
