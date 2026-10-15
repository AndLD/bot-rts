import { SetMetadata } from '@nestjs/common'
import type { Request } from 'express'
import { Feature } from '../../../../lib/utils/interfaces/features'

export const REQUIRE_FEATURE_KEY = 'requireFeature'

export interface FeatureRequirement {
  feature: Feature
  // The route needs the feature only for some requests (a base deployed with a spawn seed)
  when?: (request: Request) => boolean
}

// The route works only while every feature it names is on; otherwise it answers FEATURE_DISABLED
export const RequireFeatures = (...requirements: FeatureRequirement[]) => SetMetadata(REQUIRE_FEATURE_KEY, requirements)

export const RequireFeature = (feature: Feature, when?: FeatureRequirement['when']) =>
  RequireFeatures({ feature, when })
