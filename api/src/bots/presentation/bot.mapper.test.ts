import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { buildBase } from '../../../tests/integration/builders'
import { toBotDto } from './bot.mapper'

describe('toBotDto', () => {
  it('leaves out what a bot does not have', () => {
    const dto = toBotDto(buildBase('user-1', { label: null }))

    expect(dto).toMatchObject({ type: BOT_TYPE.BASE, userId: 'user-1' })
    expect(dto.label).toBeUndefined()
    expect(dto.baseId).toBeUndefined()
    expect(dto.lastPosition).toBeUndefined()
  })

  it('shows the last position of a bot without modules', () => {
    expect(toBotDto(buildBase('user-1', { lastPosition: { x: 1, y: 2, z: 0 } })).lastPosition).toEqual({
      x: 1,
      y: 2,
      z: 0
    })
  })
})
