import { IUsersFilter, USER_STATUSES, UserStatus } from '../../lib/utils/interfaces/users'

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

export interface UsersQuery {
  filter: IUsersFilter
  page: number
  results: number
}

type RawQuery = Record<string, unknown>

function parsePositiveInt(value: unknown, fallback: number): number | undefined {
  if (value === undefined) {
    return fallback
  }

  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN

  return parsed >= 1 ? parsed : undefined
}

function parseBoolean(value: unknown): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined
}

// Builds a typed query from the request query string; returns undefined when any parameter is malformed
export function parseUsersQuery(query: RawQuery): UsersQuery | undefined {
  const page = parsePositiveInt(query.page, 1)
  const results = parsePositiveInt(query.results, DEFAULT_PAGE_SIZE)

  if (page === undefined || results === undefined || results > MAX_PAGE_SIZE) {
    return undefined
  }

  const filter: IUsersFilter = {}

  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !USER_STATUSES.includes(query.status as UserStatus)) {
      return undefined
    }
    filter.status = query.status as UserStatus
  }

  if (query.active !== undefined) {
    const active = parseBoolean(query.active)

    if (active === undefined) {
      return undefined
    }
    filter.active = active
  }

  if (query.email !== undefined) {
    if (typeof query.email !== 'string') {
      return undefined
    }
    filter.email = query.email
  }

  return { filter, page, results }
}
