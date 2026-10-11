import { ApiPropertyOptional } from '@nestjs/swagger'
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
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 10 })
  results: number = 10

  @IsOptional()
  @IsIn(USER_STATUSES)
  @ApiPropertyOptional({ enum: USER_STATUSES })
  status?: UserStatus

  // The email is verified
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  @ApiPropertyOptional({ description: 'The email is verified' })
  active?: boolean

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ format: 'email' })
  email?: string
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(NAME_PATTERN, { message: 'name must be a first and last name' })
  @ApiPropertyOptional()
  name?: string

  @IsOptional()
  @IsIn(SUBSCRIPTIONS)
  @ApiPropertyOptional({ enum: SUBSCRIPTIONS })
  subscription?: Subscription

  @IsOptional()
  @IsIn(USER_STATUSES)
  @ApiPropertyOptional({ enum: USER_STATUSES, description: 'Only an owner may change the status' })
  status?: UserStatus
}
