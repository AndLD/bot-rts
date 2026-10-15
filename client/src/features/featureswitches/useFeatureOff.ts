import type { Feature } from '@lib/utils/interfaces/features'
import { useFeaturesStatusQuery } from '../../shared/api'

const POLL_MS = 60_000

// Whether an admin has switched the feature off (design §25.3). It asks the public status, so it also works before sign-in, and
// is false until the answer is known: the server refuses a switched-off feature anyway, the screen only explains it earlier.
export function useFeatureOff(feature: Feature): boolean {
  const { data } = useFeaturesStatusQuery(undefined, { pollingInterval: POLL_MS })

  return data?.features?.[feature] === false
}
