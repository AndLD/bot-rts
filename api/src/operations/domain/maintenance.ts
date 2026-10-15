import { BANNER_MAX_LENGTH, IMaintenanceBanner } from '../../../../lib/utils/admin-operations'

// What is wrong with a banner, empty when it can be shown
export function bannerProblems({ message, startsAt, endsAt }: IMaintenanceBanner): string[] {
  const problems: string[] = []
  const text = message.trim()

  if (!text || text.length > BANNER_MAX_LENGTH) {
    problems.push(`The message must have 1 to ${BANNER_MAX_LENGTH} characters`)
  }
  if (!Number.isFinite(startsAt) || (endsAt !== null && !Number.isFinite(endsAt))) {
    problems.push('The times must be valid')
  } else if (endsAt !== null && endsAt <= startsAt) {
    problems.push('The end must be after the start')
  }

  return problems
}

// Whether visitors are shown the banner now: from the moment it is set until the end, if there is one
export function isBannerShown(banner: IMaintenanceBanner | null, now: number): banner is IMaintenanceBanner {
  return banner !== null && (banner.endsAt === null || now < banner.endsAt)
}
