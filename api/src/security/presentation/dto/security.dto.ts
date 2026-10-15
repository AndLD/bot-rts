import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt } from 'class-validator'
import {
  IBotLockout,
  IFailedLoginGroup,
  IMultiIpAccount,
  IPlayerRef,
  IScriptConsumer,
  ISecurityApiKey,
  ISecurityOverview,
  ISameIpGroup,
  ISuspiciousScript,
  SECURITY_WINDOW_HOURS
} from '../../../../../lib/utils/admin-security'

export class SecurityQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsIn(SECURITY_WINDOW_HOURS)
  @ApiProperty({ enum: SECURITY_WINDOW_HOURS, default: 24, description: 'How far back to look, in hours' })
  hours: number = 24
}

class PlayerRefModel implements IPlayerRef {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string
}

class FailedLoginModel implements IFailedLoginGroup {
  @ApiProperty()
  key!: string

  @ApiProperty()
  failures!: number

  @ApiProperty()
  distinctEmails!: number

  @ApiProperty()
  lastAt!: number
}

class SameIpModel implements ISameIpGroup {
  @ApiProperty()
  ip!: string

  @ApiProperty({ type: [PlayerRefModel] })
  accounts!: PlayerRefModel[]
}

class MultiIpModel extends PlayerRefModel implements IMultiIpAccount {
  @ApiProperty()
  ips!: number
}

class BotLockoutModel implements IBotLockout {
  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty({ type: String, nullable: true })
  label!: string | null

  @ApiProperty({ type: String, nullable: true })
  ownerId!: string | null

  @ApiProperty({ type: String, nullable: true })
  ownerName!: string | null

  @ApiProperty()
  failures!: number

  @ApiProperty()
  lockedUntil!: number
}

class SecurityKeyModel implements ISecurityApiKey {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  prefix!: string

  @ApiProperty({ type: PlayerRefModel })
  owner!: PlayerRefModel

  @ApiProperty({ type: [String] })
  scopes!: string[]

  @ApiProperty()
  ratePerMinute!: number

  @ApiProperty()
  createdAt!: number

  @ApiProperty({ type: Number, nullable: true })
  lastUsedAt!: number | null

  @ApiProperty({ type: Number, nullable: true })
  expiresAt!: number | null

  @ApiProperty()
  isRevoked!: boolean

  @ApiProperty()
  rateLimitHits!: number
}

class SuspiciousScriptModel implements ISuspiciousScript {
  @ApiProperty({ format: 'uuid' })
  executionId!: string

  @ApiProperty({ type: PlayerRefModel })
  owner!: PlayerRefModel

  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty()
  file!: string

  @ApiProperty()
  code!: string

  @ApiProperty()
  reason!: string

  @ApiProperty()
  endedAt!: number
}

class ConsumerModel implements IScriptConsumer {
  @ApiProperty({ format: 'uuid' })
  executionId!: string

  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty()
  file!: string

  @ApiProperty()
  opsUsed!: number

  @ApiProperty()
  ticks!: number
}

export class SecurityOverviewResponse implements ISecurityOverview {
  @ApiProperty()
  hours!: number

  @ApiProperty({ type: [FailedLoginModel] })
  failedLoginsByIp!: FailedLoginModel[]

  @ApiProperty({ type: [FailedLoginModel] })
  failedLoginsByEmail!: FailedLoginModel[]

  @ApiProperty({ type: [SameIpModel] })
  sameIpAccounts!: SameIpModel[]

  @ApiProperty({ type: [MultiIpModel] })
  multiIpAccounts!: MultiIpModel[]

  @ApiProperty({ type: [BotLockoutModel] })
  botLockouts!: BotLockoutModel[]

  @ApiProperty({ type: [SecurityKeyModel] })
  apiKeys!: SecurityKeyModel[]

  @ApiProperty({ type: [SuspiciousScriptModel] })
  suspiciousScripts!: SuspiciousScriptModel[]

  @ApiProperty({ type: [ConsumerModel], nullable: true })
  topConsumers!: ConsumerModel[] | null
}
