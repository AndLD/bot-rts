import { BOT_TYPE } from '../../lib/utils/interfaces/bots'
import { MapPointType } from '../../lib/utils/interfaces/map'
import { toBotDto } from './bots/presentation/bot.mapper'
import { toMapPointDto } from './map/presentation/map-point.mapper'
import { toModuleDto } from './modules/presentation/module.mapper'
import { toUserInfo, toUserState } from './users/presentation/user.mapper'
import { buildBase, buildKnownPoint, buildModule, buildPoint, buildUser } from '../tests/integration/builders'

describe('presentation mappers', () => {
  it('maps a user to the client identity without secrets', () => {
    const user = buildUser({ updatedAt: new Date(5) })

    expect(toUserState(user)).toEqual({
      _id: user.id,
      name: 'Alice',
      email: user.email,
      status: 'user',
      active: true,
      subscription: 'free',
      createdAt: user.createdAt.getTime(),
      updatedAt: 5
    })
    expect(JSON.stringify(toUserInfo(user))).not.toContain('hash')
    expect(toUserState(buildUser()).updatedAt).toBeUndefined()
  })

  it('maps bots, leaving out empty links', () => {
    const base = buildBase('u1')

    expect(toBotDto(base)).toEqual({
      _id: base.id,
      label: 'base',
      userId: 'u1',
      baseId: undefined,
      type: BOT_TYPE.BASE
    })
    expect(toBotDto({ ...base, label: null }).label).toBeUndefined()
  })

  it('flattens module properties', () => {
    const module = buildModule('b1', { props: { damage: 50 } })

    expect(toModuleDto(module)).toEqual({
      _id: module.id,
      botId: 'b1',
      type: 'weapon',
      name: 'gun-class1',
      condition: 100,
      maxCondition: 100,
      weight: 30,
      operationCost: 5,
      idleCost: 0.05,
      damage: 50
    })
  })

  it('maps real and known points; z is shown only when it is not zero', () => {
    const real = buildPoint(1, 2, { type: MapPointType.RESOURCE })
    const known = buildKnownPoint('u1', 3, 4, { seenAt: 7 })

    expect(toMapPointDto(real)).toEqual({ _id: real.id, location: { x: 1, y: 2 }, contentId: null, type: 'resource' })
    expect(toMapPointDto(known)).toMatchObject({ userId: 'u1', seenAt: 7 })
    expect(toMapPointDto({ ...real, location: { x: 1, y: 2, z: 3 } }).location).toEqual({ x: 1, y: 2, z: 3 })
  })
})
