import { resolveRedirect } from './access'

describe('resolveRedirect', () => {
  it.each(['anonymous', 'unverified', 'blocked', 'active'] as const)(
    'lets a %s visitor open the emailed link pages',
    (state) => {
      for (const path of ['/verification', '/confirm-email-change', '/confirm-account-deletion']) {
        expect(resolveRedirect(state, path)).toBeNull()
      }
    }
  )

  it('keeps the loading state in place, whatever the page', () => {
    expect(resolveRedirect('loading', '/game')).toBeNull()
  })

  it.each([
    ['anonymous', '/game', '/auth'],
    ['anonymous', '/account', '/auth'],
    ['unverified', '/game', '/forbidden'],
    ['blocked', '/auth', '/blocked'],
    ['active', '/auth', '/game'],
    ['active', '/forbidden', '/game']
  ] as const)('sends a %s visitor from %s to %s', (state, path, expected) => {
    expect(resolveRedirect(state, path)).toBe(expected)
  })

  it.each([
    ['anonymous', '/auth'],
    ['anonymous', '/forgot-password'],
    ['anonymous', '/reset-password'],
    ['unverified', '/forbidden'],
    ['blocked', '/blocked'],
    ['active', '/game'],
    ['active', '/account'],
    ['active', '/admin'],
    ['active', '/admin/audit']
  ] as const)('lets a %s visitor stay on %s', (state, path) => {
    expect(resolveRedirect(state, path)).toBeNull()
  })

  it.each([
    ['anonymous', '/admin', '/auth'],
    ['unverified', '/admin', '/forbidden'],
    ['blocked', '/admin/audit', '/blocked'],
    ['active', '/administrator', '/game']
  ] as const)('keeps a %s visitor out of %s, and does not take %s for the console', (state, path, expected) => {
    expect(resolveRedirect(state, path)).toBe(expected)
  })
})
