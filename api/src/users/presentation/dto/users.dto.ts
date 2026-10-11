import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import { SUBSCRIPTIONS, Subscription, USER_STATUSES, UserStatus } from '../../../../../lib/utils/interfaces/users'
import { NAME_PATTERN } from '../../../../../lib/utils/validation'

export const MAX_PAGE_SIZE = 100

// Query-string booleans arrive as the strings "true" and "false"
const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)

export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  results: number = 10

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus

  // The email is verified
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsEmail()
  email?: string
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(NAME_PATTERN, { message: 'name must be a first and last name' })
  name?: string

  @IsOptional()
  @IsIn(SUBSCRIPTIONS)
  subscription?: Subscription

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus
}
