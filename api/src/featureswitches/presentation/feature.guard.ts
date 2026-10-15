import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { FeatureSwitchesService } from '../application/feature-switches.service'
import { FeatureRequirement, REQUIRE_FEATURE_KEY } from './require-feature.decorator'

// Holds a route to the feature it names with @RequireFeature(), for every caller
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureSwitchesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirements =
      this.reflector.getAllAndOverride<FeatureRequirement[] | undefined>(REQUIRE_FEATURE_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? []
    const request = requirements.length ? context.switchToHttp().getRequest<Request>() : null

    for (const { feature, when } of requirements) {
      if (!when || when(request as Request)) {
        await this.features.assertEnabled(feature)
      }
    }

    return true
  }
}
