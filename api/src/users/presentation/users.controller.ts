import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IUserInfo } from '../../../../lib/utils/interfaces/users'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { RequireRole } from '../../auth/presentation/roles.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { UsersService } from '../application/users.service'
import { ListUsersQueryDto, UpdateUserDto } from './dto/users.dto'
import { toUserInfo } from './user.mapper'

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentPrincipal() { user, identity }: Principal): IUserInfo {
    return toUserInfo(user, identity.emailVerified)
  }

  @RequireRole('admin')
  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    const { users, total } = await this.users.list({
      status: query.status,
      isEmailVerified: query.active,
      email: query.email,
      page: query.page,
      pageSize: query.results
    })

    return {
      result: users.map(({ isEmailVerified, ...user }) => toUserInfo(user, isEmailVerified)),
      meta: { pagination: { page: query.page, results: query.results, total } }
    }
  }

  @RequireRole('admin')
  @Put(':id')
  async update(
    @CurrentPrincipal() { user: actor }: Principal,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })) id: string,
    @Body() body: UpdateUserDto
  ) {
    if (!Object.keys(body).length) {
      throw new ValidationError('Nothing to update')
    }

    const { isEmailVerified, ...updated } = await this.users.update(actor.status, id, body)

    return { result: toUserInfo(updated, isEmailVerified) }
  }
}
