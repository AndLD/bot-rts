import { AnalyticsReport, IAnalytics } from '../../../../lib/utils/admin-analytics'
import { toCsv } from '../../admin/domain/csv'

const percent = (share: number | null) => (share === null ? '' : `${Math.round(share * 1000) / 10}`)

// One report of the Analytics page as CSV, for the export of the console. Shares are percentages.
export function analyticsCsv(report: AnalyticsReport, analytics: IAnalytics): string {
  switch (report) {
    case 'activity':
      return toCsv(
        ['day', 'active players'],
        analytics.activity.daily.map(({ day, users }) => [day, users])
      )
    case 'retention':
      return toCsv(
        ['cohort (week starting)', 'players', 'day 1 %', 'day 7 %', 'day 30 %'],
        analytics.retention.map((row) => [row.cohort, row.size, percent(row.d1), percent(row.d7), percent(row.d30)])
      )
    case 'funnel':
      return toCsv(
        ['step', 'players'],
        analytics.funnel.map(({ step, users }) => [step, users])
      )
    case 'achievements':
      return toCsv(
        ['achievement', 'players', 'share of players %'],
        analytics.achievements.map(({ id, unlocked, share }) => [id, unlocked, percent(share)])
      )
  }
}
