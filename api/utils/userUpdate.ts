import { IUserPutBody, SUBSCRIPTIONS, Subscription, USER_STATUSES, UserStatus } from '../../lib/utils/interfaces/users'
import { user as userValidation } from '../validation/public/users'

const OWNER_ONLY_FIELDS: readonly (keyof IUserPutBody)[] = ['status', 'active', 'password']
const ALLOWED_FIELDS: readonly (keyof IUserPutBody)[] = ['name', 'subscription', ...OWNER_ONLY_FIELDS]

// Whitelists the update body and checks the type of every field; returns undefined when the body is invalid
export function parseUserPutBody(body: unknown): IUserPutBody | undefined {
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

  return isValid ? (raw as IUserPutBody) : undefined
}

export function hasOwnerOnlyFields(body: IUserPutBody): boolean {
  return OWNER_ONLY_FIELDS.some((field) => body[field] !== undefined)
}
