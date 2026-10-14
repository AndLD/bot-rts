import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from 'class-validator'
import {
  API_KEY_LIMITS,
  API_SCOPES,
  ApiScope,
  IApiKey,
  ICreatedApiKey
} from '../../../../../lib/utils/interfaces/api-keys'

export class CreateApiKeyDto {
  @IsString()
  @Length(1, API_KEY_LIMITS.nameMaxLength)
  @ApiProperty({ maxLength: API_KEY_LIMITS.nameMaxLength, example: 'My dashboard' })
  name!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(API_SCOPES.length)
  @IsEnum(API_SCOPES, { each: true })
  @ApiProperty({
    enum: API_SCOPES,
    isArray: true,
    description: 'What the key may do; it can only narrow what the player may do'
  })
  scopes!: ApiScope[]

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(API_KEY_LIMITS.maxRatePerMinute)
  @ApiPropertyOptional({
    default: API_KEY_LIMITS.defaultRatePerMinute,
    minimum: 1,
    maximum: API_KEY_LIMITS.maxRatePerMinute,
    description: 'Requests per minute'
  })
  ratePerMinute?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(API_KEY_LIMITS.maxExpiresInDays)
  @ApiPropertyOptional({
    description: 'The key stops working after this many days; without it the key does not expire'
  })
  expiresInDays?: number
}

export class ApiKeyResponse implements IApiKey {
  @ApiProperty() _id!: string
  @ApiProperty() name!: string
  @ApiProperty({ example: 'botrts_ab12' }) prefix!: string
  @ApiProperty({ enum: API_SCOPES, isArray: true }) scopes!: ApiScope[]
  @ApiProperty() ratePerMinute!: number
  @ApiProperty() createdAt!: number
  @ApiProperty({ nullable: true, type: Number }) lastUsedAt!: number | null
  @ApiProperty({ nullable: true, type: Number }) expiresAt!: number | null
  @ApiProperty({ nullable: true, type: Number }) revokedAt!: number | null
}

export class CreatedApiKeyResponse extends ApiKeyResponse implements ICreatedApiKey {
  @ApiProperty({ description: 'The key itself. It is shown only now; only its hash is stored' }) secret!: string
}
