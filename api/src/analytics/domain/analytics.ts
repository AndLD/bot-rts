import { IRetentionCohort, RETENTION_DAYS } from '../../../../lib/utils/admin-analytics'
import { CohortRow } from '../application/ports'

const DAY_MS = 24 * 60 * 60 * 1000

export const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

// The days from `from` to `to`, both included
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []

  for (let at = Date.parse(from); at <= Date.parse(to); at += DAY_MS) {
    days.push(dayOf(new Date(at)))
  }

  return days
}

// A cohort can tell how many came back N days after signing up only once the last of its members has had those N days
export function retentionOf(row: CohortRow, today: string): IRetentionCohort {
  const lastSignUp = Date.parse(row.week) + 6 * DAY_MS
  const share = (days: number, count: number) =>
    lastSignUp + days * DAY_MS <= Date.parse(today) ? count / row.size : null
  const [one, seven, thirty] = RETENTION_DAYS

  return {
    cohort: row.week,
    size: row.size,
    d1: share(one, row.d1),
    d7: share(seven, row.d7),
    d30: share(thirty, row.d30)
  }
}
