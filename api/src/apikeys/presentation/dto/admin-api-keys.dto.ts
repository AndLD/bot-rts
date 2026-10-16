import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from 'class-validator'
import {
  ADMIN_API_KEY_LIMITS,
  ADMIN_API_SCOPES,
  AdminApiScope,
  IAdminApiKey,
  ICreatedAdminApiKey
} from '../../../../../lib/utils/admin-api-keys'

export class CreateAdminApiKeyDto {
  @IsString()
  @Length(1, ADMIN_API_KEY_LIMITS.nameMaxLength)
  @ApiProperty({ maxLength: ADMIN_API_KEY_LIMITS.nameMaxLength, example: 'Investigation assistant' })
  name!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @ArrayMaxSize(ADMIN_API_SCOPES.length)
  @IsEnum(ADMIN_API_SCOPES, { each: true })
  // Not an enum in the spec: the public spec never lists the admin scopes (they are in the admin documentation)
  @ApiProperty({ type: String, isArray: true, description: 'Read-only admin scopes; see the admin documentation' })
  scopes!: AdminApiScope[]

  @IsString()
  @Length(ADMIN_API_KEY_LIMITS.reasonMinLength, ADMIN_API_KEY_LIMITS.reasonMaxLength)
  @ApiProperty({ minLength: ADMIN_API_KEY_LIMITS.reasonMinLength, maxLength: ADMIN_API_KEY_LIMITS.reasonMaxLength })
  reason!: string

  @IsInt()
  @Min(1)
  @Max(ADMIN_API_KEY_LIMITS.maxExpiresInDaysCeiling)
  @ApiProperty({
    minimum: 1,
    maximum: ADMIN_API_KEY_LIMITS.maxExpiresInDaysCeiling,
    description:
      'The key stops working after this many days; the server setting ADMIN_API_KEY_MAX_DAYS is the real limit'
  })
  expiresInDays!: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ADMIN_API_KEY_LIMITS.maxIpAllowList)
  @IsIP(undefined, { each: true })
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Addresses the key may be used from; empty means any'
  })
  ipAllowList?: string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(ADMIN_API_KEY_LIMITS.maxRatePerMinute)
  @ApiPropertyOptional({ default: ADMIN_API_KEY_LIMITS.defaultRatePerMinute, description: 'Requests per minute' })
  ratePerMinute?: number
}

export class AdminApiKeyResponse implements IAdminApiKey {
  @ApiProperty() _id!: string
  @ApiProperty() name!: string
  @ApiProperty({ example: 'botrts_ab12' }) prefix!: string
  @ApiProperty({ type: String, isArray: true }) scopes!: AdminApiScope[]
  @ApiProperty() ratePerMinute!: number
  @ApiProperty() ownerId!: string
  @ApiProperty() reason!: string
  @ApiProperty({ type: String, isArray: true }) ipAllowList!: string[]
  @ApiProperty() createdAt!: number
  @ApiProperty({ nullable: true, type: Number }) lastUsedAt!: number | null
  @ApiProperty() expiresAt!: number
  @ApiProperty({ nullable: true, type: Number }) revokedAt!: number | null
}

export class CreatedAdminApiKeyResponse extends AdminApiKeyResponse implements ICreatedAdminApiKey {
  @ApiProperty({ description: 'The key itself. It is shown only now; only its hash is stored' }) secret!: string
}
