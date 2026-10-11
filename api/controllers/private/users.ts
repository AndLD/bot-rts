import { Response } from 'express'
import { AppServices } from '../../src/composition'
import { ValidationError } from '../../src/shared/domain/errors'
import { isValidId } from '../../src/shared/domain/ids'
import { toUserInfo } from '../../src/users/presentation/user.mapper'
import { parseUserPatch } from '../../src/users/presentation/user-update'
import { parseUsersQuery } from '../../src/users/presentation/users-query'
import { AuthorizedRequest } from '../../middlewares/authorization'

export function createUsersPrivateControllers({ users }: Pick<AppServices, 'users'>) {
  return {
    async get(req: AuthorizedRequest, res: Response) {
      const query = parseUsersQuery(req.query)

      if (!query) {
        throw new ValidationError('Invalid filters in query params')
      }

      const { filter, page, results } = query
      const { users: found, total } = await users.list({
        status: filter.status,
        isActive: filter.active,
        email: filter.email,
        page,
        pageSize: results
      })

      res.json({ result: found.map(toUserInfo), meta: { pagination: { page, results, total } } })
    },

    async put(req: AuthorizedRequest, res: Response) {
      const patch = parseUserPatch(req.body)

      if (!isValidId(req.params.id) || !patch) {
        throw new ValidationError()
      }

      res.json({ result: toUserInfo(await users.update(req.user!.status, req.params.id, patch)) })
    }
  }
}
