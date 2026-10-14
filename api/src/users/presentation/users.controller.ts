import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IUserInfo } from '../../../../lib/utils/interfaces/users'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { RequireRole } from '../../auth/presentation/roles.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { UsersService } from '../application/users.service'
import { UserInfoResponse, UsersPageResponse, UserUpdatedResponse } from './dto/users.response'
import { ListUsersQueryDto, UpdateUserDto } from './dto/users.dto'
import { toUserInfo } from './user.mapper'
import { RequireScope, SessionOnly } from '../../apikeys/presentation/scope.decorator'

@ApiTags('users')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOkResponse({ type: UserInfoResponse })
  @RequireScope('read')
  @Get('me')
  me(@CurrentPrincipal() { user, identity }: Principal): IUserInfo {
    return toUserInfo(user, identity.emailVerified)
  }

  @RequireRole('admin')
  @ApiOkResponse({ type: UsersPageResponse })
  @SessionOnly()
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
  @ApiOkResponse({ type: UserUpdatedResponse })
  @SessionOnly()
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
