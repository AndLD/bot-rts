import { IActivityDay } from '../../../../lib/utils/admin-analytics'

export const ANALYTICS_READ_MODEL = Symbol('AnalyticsReadModel')

export interface CohortRow {
  // The Monday of the week
  week: string
  size: number
  // How many were active on the 1st, 7th and 30th day after signing up
  d1: number
  d7: number
  d30: number
}

// What the Analytics page reads of the game. Players are the accounts that are not erased and have no admin role.
export interface AnalyticsReadModel {
  playerCount(): Promise<number>
  // Players active on each day from `from` (a day, "2026-10-15"); days with nobody are left out
  dailyActive(from: string): Promise<IActivityDay[]>
  // Different players active on any day from `from`
  activeSince(from: string): Promise<number>
  // Weekly cohorts of the players who signed up on or after `since`
  cohorts(since: Date): Promise<CohortRow[]>
  // Of the players who signed up on or after `since`, how many reached each step of the funnel, in the order of FUNNEL_STEPS
  funnel(since: Date): Promise<number[]>
  achievementUnlocks(): Promise<Array<{ id: string; unlocked: number }>>
}
