import { isValidId } from '../../shared/domain/ids'

function readUserField(payload: unknown, field: string): string | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const user = (payload as { user?: unknown }).user

  if (typeof user !== 'object' || user === null) {
    return undefined
  }

  const value = (user as Record<string, unknown>)[field]

  return isValidId(value) ? value : undefined
}

// Access and refresh tokens carry the user id as `user._id`; only the id is trusted, everything else is read from the DB
export function parseUserIdFromSessionToken(payload: unknown): string | undefined {
  return readUserField(payload, '_id')
}

export function parseUserIdFromEmailVerificationToken(payload: unknown): string | undefined {
  return readUserField(payload, 'id')
}
