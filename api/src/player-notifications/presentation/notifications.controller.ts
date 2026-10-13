import { Body, Controller, Get, HttpCode, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import {
  INotificationList,
  INotificationPreferences,
  INotificationSummary
} from '../../../../lib/utils/interfaces/notifications'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { NotificationService } from '../application/notification.service'
import {
  ListNotificationsQueryDto,
  MarkedReadResponse,
  MarkReadDto,
  NotificationListResponse,
  NotificationPreferencesResponse,
  NotificationSummaryResponse,
  UpdateNotificationPreferencesDto
} from './notifications.dto'

// The notification center of a player (design §24.2, §24.3): what the game told them, newest first, kept for 30 days by default
@ApiTags('notifications')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @ApiOkResponse({ type: NotificationListResponse })
  @Get()
  list(@CurrentPrincipal() { user }: Principal, @Query() query: ListNotificationsQueryDto): Promise<INotificationList> {
    return this.notifications.list(user.id, { limit: query.limit, before: query.before, isUnreadOnly: query.unread })
  }

  // "While you were away": what waits unread, by category
  @ApiOkResponse({ type: NotificationSummaryResponse })
  @Get('summary')
  summary(@CurrentPrincipal() { user }: Principal): Promise<INotificationSummary> {
    return this.notifications.summary(user.id)
  }

  @HttpCode(200)
  @ApiOkResponse({ type: MarkedReadResponse })
  @Post('read')
  async markRead(@CurrentPrincipal() { user }: Principal, @Body() body: MarkReadDto): Promise<MarkedReadResponse> {
    return { marked: await this.notifications.markRead(user.id, body.ids) }
  }

  @ApiOkResponse({ type: NotificationPreferencesResponse })
  @Get('preferences')
  preferences(@CurrentPrincipal() { user }: Principal): Promise<INotificationPreferences> {
    return this.notifications.getPreferences(user.id)
  }

  @ApiOkResponse({ type: NotificationPreferencesResponse })
  @Patch('preferences')
  updatePreferences(
    @CurrentPrincipal() { user }: Principal,
    @Body() body: UpdateNotificationPreferencesDto
  ): Promise<INotificationPreferences> {
    return this.notifications.updatePreferences(user.id, body.categories ?? {})
  }
}
