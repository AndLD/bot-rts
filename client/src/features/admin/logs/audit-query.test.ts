import { queryOf } from './audit-query'

describe('queryOf', () => {
  it('writes the filters that are set and leaves out the empty ones', () => {
    expect(queryOf({ action: 'players.ban', actorId: undefined, targetId: '', outcome: 'denied' })).toBe(
      'action=players.ban&outcome=denied'
    )
  })

  it('is empty without filters', () => {
    expect(queryOf({})).toBe('')
  })
})
