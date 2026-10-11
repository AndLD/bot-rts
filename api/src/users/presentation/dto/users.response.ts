import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IFetchUsersResponse,
  IUserInfo,
  IUserPutResponse,
  SUBSCRIPTIONS,
  Subscription,
  USER_STATUSES,
  UserStatus
} from '../../../../../lib/utils/interfaces/users'

export class UserInfoResponse implements IUserInfo {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string

  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty({ enum: USER_STATUSES })
  status!: UserStatus

  @ApiProperty({ description: 'The email is verified' })
  active!: boolean

  @ApiProperty({ enum: SUBSCRIPTIONS })
  subscription!: Subscription

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  createdAt!: number

  @ApiPropertyOptional({ description: 'Milliseconds since the epoch' })
  updatedAt?: number
}

class PaginationModel {
  @ApiProperty()
  page!: number

  @ApiProperty()
  results!: number

  @ApiProperty()
  total!: number
}

class UsersMetaModel {
  @ApiProperty({ type: PaginationModel })
  pagination!: PaginationModel
}

export class UsersPageResponse implements IFetchUsersResponse {
  @ApiProperty({ type: [UserInfoResponse] })
  result!: UserInfoResponse[]

  @ApiProperty({ type: UsersMetaModel })
  meta!: UsersMetaModel
}

export class UserUpdatedResponse implements IUserPutResponse {
  @ApiProperty({ type: UserInfoResponse })
  result!: UserInfoResponse
}

export class StatisticsResponse {
  @ApiProperty({
    type: 'object',
    properties: Object.fromEntries(USER_STATUSES.map((status) => [status, { type: 'integer' }])),
    required: [...USER_STATUSES]
  })
  usersByStatus!: Record<UserStatus, number>

  @ApiProperty({ format: 'date-time', description: 'When this server instance started' })
  startedAt!: string
}
