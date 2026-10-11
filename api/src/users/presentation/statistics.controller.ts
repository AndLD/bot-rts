import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RequireRole } from '../../auth/presentation/roles.decorator'
import { UsersService } from '../application/users.service'
import { UserCountByStatus } from '../application/user.repository'

export interface Statistics {
  usersByStatus: UserCountByStatus
  // When this server instance started
  startedAt: string
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/statistics', version: '1' })
export class StatisticsController {
  private readonly startedAt = new Date().toISOString()

  constructor(private readonly users: UsersService) {}

  @RequireRole('admin')
  @Get()
  async get(): Promise<Statistics> {
    return { usersByStatus: await this.users.countByStatus(), startedAt: this.startedAt }
  }
}
