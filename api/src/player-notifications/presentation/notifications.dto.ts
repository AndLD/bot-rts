import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import {
  INotification,
  INotificationList,
  INotificationPreferences,
  INotificationSummary,
  NOTIFICATION_CATEGORIES,
  NotificationCategory
} from '../../../../lib/utils/interfaces/notifications'
import { MAX_PAGE } from '../application/notification.service'

const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE, default: 50 })
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Only notifications older than this time (ms since the epoch), for the next page'
  })
  before?: number

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Only those not read yet' })
  unread?: boolean
}

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PAGE)
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String], description: 'The notifications to mark as read; every one when left out' })
  ids?: string[]
}

export class NotificationResponse implements INotification {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  category!: NotificationCategory

  @ApiProperty({ description: 'What happened, for example `underAttack`; the translation key of its text' })
  kind!: string

  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
    description: 'What the text needs, such as the module or the number of bars'
  })
  params!: Record<string, string | number | boolean>

  @ApiProperty({ type: String, nullable: true })
  botId!: string | null

  @ApiProperty({ description: 'How many times it happened (repeated events are coalesced)' })
  count!: number

  @ApiProperty({ description: 'When it happened (ms since the epoch); the last time for a coalesced one' })
  createdAt!: number

  @ApiProperty({ type: Number, nullable: true })
  readAt!: number | null
}

export class NotificationListResponse implements INotificationList {
  @ApiProperty({ type: [NotificationResponse] })
  items!: NotificationResponse[]

  @ApiProperty({ description: 'How many the player has not read, in all' })
  unread!: number
}

export class NotificationSummaryResponse implements INotificationSummary {
  @ApiProperty()
  unread!: number

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Unread, by category' })
  byCategory!: Partial<Record<NotificationCategory, number>>
}

export class MarkedReadResponse {
  @ApiProperty({ description: 'How many were marked as read' })
  marked!: number
}

export class NotificationPreferencesResponse implements INotificationPreferences {
  @ApiProperty({
    type: 'object',
    properties: Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, { type: 'boolean' }])),
    description: 'Which categories the player wants to hear about'
  })
  categories!: INotificationPreferences['categories']
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ApiPropertyOptional({
    type: 'object',
    properties: Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, { type: 'boolean' }]))
  })
  categories?: Partial<Record<string, unknown>>
}
