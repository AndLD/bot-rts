import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { RequireRole } from '../../auth/presentation/roles.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { StatisticsResponse } from './dto/users.response'
import { UsersService } from '../application/users.service'
import { UserCountByStatus } from '../application/user.repository'

export interface Statistics {
  usersByStatus: UserCountByStatus
  // When this server instance started
  startedAt: string
}

@ApiTags('admin')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'admin/statistics', version: '1' })
export class StatisticsController {
  private readonly startedAt = new Date().toISOString()

  constructor(private readonly users: UsersService) {}

  @ApiOkResponse({ type: StatisticsResponse })
  @RequireRole('admin')
  @Get()
  async get(): Promise<Statistics> {
    return { usersByStatus: await this.users.countByStatus(), startedAt: this.startedAt }
  }
}
