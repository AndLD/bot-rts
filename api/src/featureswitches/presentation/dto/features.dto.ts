import { ApiProperty } from '@nestjs/swagger'
import { Allow, IsObject, IsString, Length } from 'class-validator'
import {
  FEATURES,
  FeatureSwitches,
  IFeatureStatus,
  IFeatureSwitches
} from '../../../../../lib/utils/interfaces/features'

const featuresSchema = {
  type: 'object' as const,
  properties: Object.fromEntries(FEATURES.map((feature) => [feature, { type: 'boolean' as const }])),
  required: [...FEATURES],
  additionalProperties: false
}

export class FeatureStatusResponse implements IFeatureStatus {
  @ApiProperty({ ...featuresSchema, description: 'Whether each feature is on' })
  features!: FeatureSwitches
}

export class FeatureSwitchesResponse extends FeatureStatusResponse implements IFeatureSwitches {
  @ApiProperty({ type: Number, nullable: true })
  updatedAt!: number | null
}

export class UpdateFeatureSwitchesDto {
  @IsObject()
  @Allow()
  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' }, description: 'The features to switch' })
  features!: Partial<Record<string, unknown>>

  @IsString()
  @Length(3, 500)
  @ApiProperty({ minLength: 3, maxLength: 500 })
  reason!: string
}
