import { afterFailure, DEFAULT_BOT_SECURITY, isLockedOut, NO_ATTEMPTS } from './bot-security'

const policy = { ...DEFAULT_BOT_SECURITY, maxFailures: 3, lockoutMs: 1000 }
const now = new Date('2026-01-01T00:00:00Z')

describe('bot security rules', () => {
  it('counts failures in a row and locks out on the last allowed one', () => {
    const one = afterFailure(NO_ATTEMPTS, now, policy)
    const two = afterFailure(one, now, policy)
    const three = afterFailure(two, now, policy)

    expect([one.failures, two.failures]).toEqual([1, 2])
    expect(three).toEqual({ failures: 0, lockedUntil: new Date(now.getTime() + 1000) })
  })

  it('is locked until the time passes', () => {
    const locked = afterFailure(afterFailure(afterFailure(NO_ATTEMPTS, now, policy), now, policy), now, policy)

    expect(isLockedOut(locked, new Date(now.getTime() + 999))).toBe(true)
    expect(isLockedOut(locked, new Date(now.getTime() + 1000))).toBe(false)
    expect(isLockedOut(NO_ATTEMPTS, now)).toBe(false)
  })
})
