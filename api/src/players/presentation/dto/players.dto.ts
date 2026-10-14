import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDate, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import {
  BAN_DURATION_HOURS_MAX,
  IPlayerBan,
  IPlayerBase,
  IPlayerListItem,
  IPlayerNote,
  IPlayerProfile,
  IPlayerResource,
  IPlayerSession,
  IPlayersPage,
  ITimelineEntry,
  PLAYER_SORTS,
  PlayerSort,
  TIMELINE_KINDS,
  TimelineKind
} from '../../../../../lib/utils/admin-players'
import { USER_STATUSES, UserStatus } from '../../../../../lib/utils/interfaces/users'

const MAX_PAGE_SIZE = 100
const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)
const toDate = ({ value }: { value: unknown }) => new Date(value as string)

export class ListPlayersQueryDto {
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
  @Max(MAX_PAGE_SIZE)
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  results: number = 20

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @ApiPropertyOptional({ description: 'Part of the name or email, or the exact id' })
  q?: string

  @IsOptional()
  @IsIn(USER_STATUSES)
  @ApiPropertyOptional({ enum: USER_STATUSES })
  status?: UserStatus

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  @ApiPropertyOptional()
  isEmailVerified?: boolean

  @IsOptional()
  @Transform(toDate)
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  registeredFrom?: Date

  @IsOptional()
  @Transform(toDate)
  @IsDate()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  registeredTo?: Date

  @IsOptional()
  @IsIn(PLAYER_SORTS)
  @ApiPropertyOptional({ enum: PLAYER_SORTS, default: 'createdAt' })
  sort: PlayerSort = 'createdAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  order: 'asc' | 'desc' = 'desc'
}

// Every action that changes something says why; the reason goes to the audit trail
export class ReasonDto {
  @IsString()
  @Length(3, 500)
  @ApiProperty({ minLength: 3, maxLength: 500 })
  reason!: string
}

export class BanPlayerDto extends ReasonDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(BAN_DURATION_HOURS_MAX)
  @ApiPropertyOptional({
    minimum: 1,
    maximum: BAN_DURATION_HOURS_MAX,
    description: 'Omitted: until an admin lifts the ban'
  })
  durationHours?: number
}

export class ChangeRoleDto extends ReasonDto {
  @IsIn(USER_STATUSES)
  @ApiProperty({ enum: USER_STATUSES })
  role!: UserStatus
}

export class DeletePlayerDto extends ReasonDto {
  @IsEmail()
  @ApiProperty({ format: 'email', description: "The player's current email, typed to confirm" })
  confirmEmail!: string
}

export class AddNoteDto {
  @IsString()
  @Length(1, 2000)
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  text!: string
}

export class PlayerListItemResponse implements IPlayerListItem {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  email!: string

  @ApiProperty({ enum: USER_STATUSES })
  status!: UserStatus

  @ApiProperty()
  isEmailVerified!: boolean

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  createdAt!: number

  @ApiProperty({ type: Number, nullable: true })
  lastLoginAt!: number | null
}

class PaginationModel {
  @ApiProperty()
  page!: number

  @ApiProperty()
  results!: number

  @ApiProperty()
  total!: number
}

class PlayersMetaModel {
  @ApiProperty({ type: PaginationModel })
  pagination!: PaginationModel
}

export class PlayersPageResponse implements IPlayersPage {
  @ApiProperty({ type: [PlayerListItemResponse] })
  result!: PlayerListItemResponse[]

  @ApiProperty({ type: PlayersMetaModel })
  meta!: PlayersMetaModel
}

class PlayerSessionModel implements IPlayerSession {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null

  @ApiProperty()
  createdAt!: number

  @ApiProperty()
  lastUsedAt!: number

  @ApiProperty()
  expiresAt!: number

  @ApiProperty()
  isActive!: boolean
}

class PlayerBaseModel implements IPlayerBase {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ type: String, nullable: true })
  label!: string | null

  @ApiProperty()
  botCount!: number
}

export class PlayerBanResponse implements IPlayerBan {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  reason!: string

  @ApiProperty({ format: 'uuid' })
  bannedBy!: string

  @ApiProperty()
  createdAt!: number

  @ApiProperty({ type: Number, nullable: true })
  expiresAt!: number | null

  @ApiProperty({ type: Number, nullable: true })
  liftedAt!: number | null

  @ApiProperty({ type: String, nullable: true })
  liftedBy!: string | null
}

export class PlayerNoteResponse implements IPlayerNote {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ format: 'uuid' })
  authorId!: string

  @ApiProperty()
  text!: string

  @ApiProperty()
  createdAt!: number
}

class TimelineEntryModel implements ITimelineEntry {
  @ApiProperty()
  at!: number

  @ApiProperty({ enum: TIMELINE_KINDS })
  kind!: TimelineKind

  @ApiProperty({ type: String, nullable: true })
  detail!: string | null
}

class PlayerResourceModel implements IPlayerResource {
  @ApiProperty()
  resource!: string

  @ApiProperty()
  amount!: number
}

export class PlayerProfileResponse extends PlayerListItemResponse implements IPlayerProfile {
  @ApiProperty()
  isDeleted!: boolean

  @ApiProperty({ type: [PlayerSessionModel] })
  sessions!: PlayerSessionModel[]

  @ApiProperty({ type: [PlayerBaseModel] })
  bases!: PlayerBaseModel[]

  @ApiProperty()
  botCount!: number

  @ApiProperty({ type: [PlayerResourceModel] })
  resources!: PlayerResourceModel[]

  @ApiProperty()
  runningExecutions!: number

  @ApiProperty({ type: PlayerBanResponse, nullable: true })
  activeBan!: PlayerBanResponse | null

  @ApiProperty({ type: [PlayerBanResponse] })
  bans!: PlayerBanResponse[]

  @ApiProperty({ type: [PlayerNoteResponse] })
  notes!: PlayerNoteResponse[]

  @ApiProperty({ type: [TimelineEntryModel] })
  timeline!: TimelineEntryModel[]
}
