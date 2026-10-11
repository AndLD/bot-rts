import { Response } from 'express'
import { IUser } from '@lib/utils/interfaces/users'
import { usersService } from '../../services/users'
import { apiUtils } from '../../utils/api'
import { errors } from '../../utils/constants'
import { tryCatch } from '../../utils/decorators'
import { isValidId } from '../../utils/objectId'
import { AuthorizedRequest } from '../../utils/types'
import { hasOwnerOnlyFields, parseUserPutBody } from '../../utils/userUpdate'
import { parseUsersQuery } from '../../utils/usersQuery'

function withoutPassword({ password, ...rest }: IUser) {
  return rest
}

async function get(req: AuthorizedRequest, res: Response) {
  const query = parseUsersQuery(req.query)

  if (!query) {
    return apiUtils.sendError(res, errors.BAD_FILTERS)
  }

  const { users, total } = await usersService.listUsers(query.filter, (query.page - 1) * query.results, query.results)

  res.json({
    result: users,
    meta: { pagination: { page: query.page, results: query.results, total } }
  })
}

async function put(req: AuthorizedRequest, res: Response) {
  const id = req.params.id
  const body = parseUserPutBody(req.body)

  if (!isValidId(id)) {
    return apiUtils.sendError(res, errors.INVALID_ID)
  }
  if (!body) {
    return apiUtils.sendError(res, errors.BAD_REQUEST)
  }

  const actorIsOwner = req.user!.status === 'owner'

  if (hasOwnerOnlyFields(body) && !actorIsOwner) {
    return apiUtils.sendError(res, errors.FORBIDDEN)
  }

  const target = await usersService.findUserById(id)

  if (!target) {
    return apiUtils.sendError(res, errors.DOC_NOT_FOUND)
  }
  if (!actorIsOwner && (target.status === 'owner' || target.status === 'admin')) {
    return apiUtils.sendError(res, errors.FORBIDDEN)
  }

  const updated = (await usersService.updateUser(id, body)) as IUser

  res.json({ result: withoutPassword(updated) })
}

export const usersPrivateControllers = {
  get: tryCatch(get),
  put: tryCatch(put)
}
