import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FEATURES, featuresWithDefaults, FeatureSwitches } from '../../../lib/utils/interfaces/features'
import { FakeClock } from '../../tests/fakes/fakes'
import { ValidationError } from '../shared/domain/errors'
import { FeatureSwitchesService, FeatureSwitchStore } from './application/feature-switches.service'
import { FeatureDisabledError } from './domain/feature.errors'
import { AdminFeaturesController, FeaturesController } from './presentation/features.controller'
import { FeatureGuard } from './presentation/feature.guard'
import { RequireFeature, RequireFeatures } from './presentation/require-feature.decorator'

class MemoryStore implements FeatureSwitchStore {
  features: FeatureSwitches = featuresWithDefaults(undefined)
  updatedAt: Date | null = null
  loads = 0

  async load() {
    this.loads += 1
    return { features: this.features, updatedAt: this.updatedAt }
  }

  async save(features: FeatureSwitches, updatedAt: Date) {
    this.features = features
    this.updatedAt = updatedAt
  }
}

function setup(cacheMs = 1000) {
  const store = new MemoryStore()
  const clock = new FakeClock()

  return { store, clock, service: new FeatureSwitchesService(store, clock, cacheMs) }
}

describe('featuresWithDefaults', () => {
  it('has every feature on unless the stored value says false', () => {
    expect(Object.values(featuresWithDefaults(null)).every(Boolean)).toBe(true)
    expect(featuresWithDefaults({ signUps: false, apiKeys: 'no' }).signUps).toBe(false)
    expect(featuresWithDefaults({ signUps: false, apiKeys: 'no' }).apiKeys).toBe(true)
  })
})

describe('FeatureSwitchesService', () => {
  it('keeps what it read for the cache time, then reads again', async () => {
    const { service, store, clock } = setup(1000)

    await service.get()
    await service.get()
    expect(store.loads).toBe(1)
    clock.current = new Date(clock.current.getTime() + 1001)
    await service.get()
    expect(store.loads).toBe(2)
  })

  it('refuses a feature that is off and names it', async () => {
    const { service } = setup(0)

    await service.assertEnabled('signUps')
    await service.update({ signUps: false })

    await expect(service.assertEnabled('signUps')).rejects.toThrow(FeatureDisabledError)
    await expect(service.assertEnabled('signUps')).rejects.toThrow('"signUps"')
    await service.assertEnabled('apiKeys')
  })

  it('changes only the named features and returns the state before and after', async () => {
    const { service, store, clock } = setup()
    await service.update({ apiKeys: false })

    const { before, after } = await service.update({ spawnSeeds: false })

    expect(before.apiKeys).toBe(false)
    expect(after.features).toEqual({ ...featuresWithDefaults(undefined), apiKeys: false, spawnSeeds: false })
    expect(after.updatedAt).toEqual(clock.now())
    expect(store.features).toEqual(after.features)
    // The node that made the change sees it at once, whatever the cache time
    expect((await service.get()).features.spawnSeeds).toBe(false)
  })

  it.each([[{}], [{ nothing: true }], [{ signUps: 'off' }]])('refuses the patch %j', async (patch) => {
    await expect(setup().service.update(patch)).rejects.toThrow(ValidationError)
  })

  it('knows every feature of the registry', async () => {
    const { service } = setup()

    for (const feature of FEATURES) {
      await service.assertEnabled(feature)
    }
  })
})

describe('FeatureGuard', () => {
  const contextFor = (body: unknown) =>
    ({
      getHandler: () => 'h',
      getClass: () => 'c',
      switchToHttp: () => ({ getRequest: () => ({ body }) })
    }) as unknown as ExecutionContext
  const reflectorWith = (requirements: unknown) => ({ getAllAndOverride: () => requirements }) as unknown as Reflector

  it('lets a route that names no feature through without asking', async () => {
    const features = { assertEnabled: jest.fn() }

    await expect(
      new FeatureGuard(reflectorWith(undefined), features as never).canActivate(contextFor({}))
    ).resolves.toBe(true)
    expect(features.assertEnabled).not.toHaveBeenCalled()
  })

  it('checks every feature the route names, the conditional one only when its condition holds', async () => {
    const features = { assertEnabled: jest.fn(async () => undefined) }
    const requirements = [
      { feature: 'baseDeployment' },
      { feature: 'spawnSeeds', when: (request: { body: { seed?: string } }) => Boolean(request.body.seed) }
    ]
    const guard = new FeatureGuard(reflectorWith(requirements), features as never)

    await guard.canActivate(contextFor({}))
    expect(features.assertEnabled.mock.calls).toEqual([['baseDeployment']])
    await guard.canActivate(contextFor({ seed: 'x' }))
    expect(features.assertEnabled.mock.calls.slice(1)).toEqual([['baseDeployment'], ['spawnSeeds']])
  })

  it('stops the request when a feature is off', async () => {
    const features = { assertEnabled: jest.fn().mockRejectedValue(new FeatureDisabledError('signUps')) }
    const guard = new FeatureGuard(reflectorWith([{ feature: 'signUps' }]), features as never)

    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(FeatureDisabledError)
  })
})

describe('the decorators', () => {
  it('store the requirements on the route', () => {
    class Routes {
      @RequireFeature('apiKeys')
      one() {}

      @RequireFeatures({ feature: 'baseDeployment' }, { feature: 'spawnSeeds' })
      two() {}
    }
    const reflector = new Reflector()

    expect(reflector.get('requireFeature', Routes.prototype.one)).toEqual([{ feature: 'apiKeys', when: undefined }])
    expect(reflector.get('requireFeature', Routes.prototype.two)).toHaveLength(2)
  })
})

describe('the controllers', () => {
  it('tell the public which features are on, and the console when they changed', async () => {
    const { service } = setup(0)
    await service.update({ publicApi: false })

    expect(await new FeaturesController(service).status()).toEqual({
      features: { ...featuresWithDefaults(undefined), publicApi: false }
    })
    const admin = new AdminFeaturesController(service)
    expect((await admin.get()).updatedAt).toEqual(expect.any(Number))
  })

  it('switches features with a reason for the audit trail', async () => {
    const { service } = setup(0)
    const detail = {}

    const result = await new AdminFeaturesController(service).update(detail, {
      features: { signUps: false },
      reason: 'incident 12'
    })

    expect(result.features.signUps).toBe(false)
    expect(detail).toMatchObject({
      targetId: 'features',
      reason: 'incident 12',
      before: featuresWithDefaults(undefined),
      after: { signUps: false }
    })
  })

  it('reads a store that nobody has written to as all on, with no change date', async () => {
    const { service } = setup()

    expect(await new AdminFeaturesController(service).get()).toEqual({
      features: featuresWithDefaults(undefined),
      updatedAt: null
    })
  })
})
