import {
  IUserPutBody,
  SUBSCRIPTIONS,
  Subscription,
  USER_STATUSES,
  UserStatus
} from '../../../../lib/utils/interfaces/users'
import { user as userValidation } from '../../../validation/public/users'
import { UserPatch } from '../domain/user-access'

const ALLOWED_FIELDS: readonly (keyof IUserPutBody)[] = ['name', 'subscription', 'status', 'active', 'password']

// Whitelists the update body and checks the type of every field; returns undefined when the body is invalid
export function parseUserPatch(body: unknown): UserPatch | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined
  }

  const raw = body as Record<string, unknown>
  const keys = Object.keys(raw)

  if (!keys.length || keys.some((key) => !ALLOWED_FIELDS.includes(key as keyof IUserPutBody))) {
    return undefined
  }

  const isValid =
    (raw.name === undefined || (typeof raw.name === 'string' && userValidation.name.regexp.test(raw.name))) &&
    (raw.subscription === undefined || SUBSCRIPTIONS.includes(raw.subscription as Subscription)) &&
    (raw.status === undefined || USER_STATUSES.includes(raw.status as UserStatus)) &&
    (raw.active === undefined || typeof raw.active === 'boolean') &&
    (raw.password === undefined ||
      (typeof raw.password === 'string' && userValidation.password.regexp.test(raw.password)))

  if (!isValid) {
    return undefined
  }

  const { active, ...rest } = raw as IUserPutBody
  return active === undefined ? rest : { ...rest, isActive: active }
}
