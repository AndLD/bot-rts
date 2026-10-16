import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator'
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  AdminPermission,
  AdminRole,
  IAdminMe,
  IAuditEntry,
  IAuditPage,
  ITwoFactorEnrollment,
  ITwoFactorRecoveryCodes
} from '../../../../../lib/utils/admin'
import { AUDIT_OUTCOMES, AuditOutcome } from '../../domain/audit-entry'

export const MAX_AUDIT_PAGE_SIZE = 200

export class TwoFactorCodeDto {
  // A six-digit authenticator code, or a recovery code
  @IsString()
  @Length(6, 16)
  @ApiProperty({ description: 'A six-digit authenticator code or a recovery code', minLength: 6, maxLength: 16 })
  code!: string
}

class TwoFactorStateModel {
  @ApiProperty()
  isEnrolled!: boolean

  @ApiProperty()
  isVerified!: boolean
}

export class AdminMeResponse implements IAdminMe {
  @ApiProperty({ enum: ADMIN_ROLES })
  role!: AdminRole

  @ApiProperty({ enum: ADMIN_PERMISSIONS, isArray: true })
  permissions!: AdminPermission[]

  @ApiProperty({ type: TwoFactorStateModel })
  twoFactor!: TwoFactorStateModel
}

export class TwoFactorEnrollmentResponse implements ITwoFactorEnrollment {
  @ApiProperty()
  secret!: string

  @ApiProperty()
  otpauthUrl!: string
}

export class TwoFactorRecoveryCodesResponse implements ITwoFactorRecoveryCodes {
  @ApiProperty({ type: [String] })
  recoveryCodes!: string[]
}

export class ListAuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_PAGE_SIZE)
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_AUDIT_PAGE_SIZE, default: 50 })
  results: number = 50

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ format: 'uuid' })
  actorId?: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'players.ban' })
  action?: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  targetId?: string

  @IsOptional()
  @IsIn(AUDIT_OUTCOMES)
  @ApiPropertyOptional({ enum: AUDIT_OUTCOMES })
  outcome?: AuditOutcome

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  from?: Date

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  to?: Date
}

export class AuditEntryResponse implements IAuditEntry {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  at!: number

  @ApiProperty({ format: 'uuid' })
  actorId!: string

  @ApiProperty()
  actorRole!: string

  @ApiProperty()
  action!: string

  @ApiProperty({ enum: AUDIT_OUTCOMES })
  outcome!: AuditOutcome

  @ApiProperty({ type: String, nullable: true })
  targetType!: string | null

  @ApiProperty({ type: String, nullable: true })
  targetId!: string | null

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null

  @ApiProperty({ nullable: true })
  before!: unknown

  @ApiProperty({ nullable: true })
  after!: unknown

  @ApiProperty({ type: String, nullable: true })
  ip!: string | null

  @ApiProperty({ type: String, nullable: true })
  requestId!: string | null

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The admin API key that made the call, if it was not a session'
  })
  apiKeyId!: string | null
}

class AuditPaginationModel {
  @ApiProperty()
  page!: number

  @ApiProperty()
  results!: number

  @ApiProperty()
  total!: number
}

class AuditMetaModel {
  @ApiProperty({ type: AuditPaginationModel })
  pagination!: AuditPaginationModel
}

export class AuditPageResponse implements IAuditPage {
  @ApiProperty({ type: [AuditEntryResponse] })
  result!: AuditEntryResponse[]

  @ApiProperty({ type: AuditMetaModel })
  meta!: AuditMetaModel
}
