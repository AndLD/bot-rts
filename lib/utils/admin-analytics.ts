// The Analytics page of the admin console (design §25.3): how many players are active, whether they come back, how far new players get,
// and how many earn each achievement. Days are UTC calendar days ("2026-10-15").

export const ANALYTICS_WINDOWS = [7, 30, 90] as const

export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number]

export const ANALYTICS_REPORTS = ['activity', 'retention', 'funnel', 'achievements'] as const

export type AnalyticsReport = (typeof ANALYTICS_REPORTS)[number]

// The length of the "monthly" in monthly active players
export const ACTIVITY_MONTH_DAYS = 30

// How many days after sign-up a cohort is looked at again
export const RETENTION_DAYS = [1, 7, 30] as const

export const FUNNEL_STEPS = [
  'signedUp',
  'verified',
  'baseDeployed',
  'firstScript',
  'firstResource',
  'tutorialCompleted'
] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

export interface IActivityDay {
  day: string
  users: number
}

export interface IActivityStats {
  // Each day of the window, the days without anyone included
  daily: IActivityDay[]
  // Active today, and in the last 30 days
  dau: number
  mau: number
}

// Players who signed up in one week (it starts on `cohort`, a Monday) and were active again 1, 7 and 30 days after signing up. A share
// is null while the cohort is too young to tell.
export interface IRetentionCohort {
  cohort: string
  size: number
  d1: number | null
  d7: number | null
  d30: number | null
}

export interface IFunnelStat {
  step: FunnelStep
  // Of the players who signed up in the window, how many got this far
  users: number
}

export interface IAchievementRate {
  id: string
  unlocked: number
  // Of all players, 0 to 1
  share: number
}

export interface IAnalytics {
  days: number
  // The players counted: everyone with a live account who is not an admin
  players: number
  activity: IActivityStats
  retention: IRetentionCohort[]
  funnel: IFunnelStat[]
  achievements: IAchievementRate[]
}
