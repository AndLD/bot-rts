import { createLocalAuthClient } from './local-auth-client'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { setupStore } from '../../shared/store'
import { api } from '../../shared/api'
import { AuthClient } from './auth-client'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)
const requestOf = (call = 0) => query.mock.calls[call][0] as { url: string; method?: string; body?: unknown }

function setup() {
  const store = setupStore()

  return { store, client: createLocalAuthClient(store) }
}

const succeed = (data: unknown = {}) => query.mockResolvedValueOnce({ data })
const fail = (status: number, data?: unknown) => query.mockResolvedValueOnce({ error: { status, data } })

describe('local auth client', () => {
  beforeEach(() => {
    query.mockReset()
    localStorage.clear()
  })

  describe('the cache of the previous player', () => {
    // What the previous player's session left in the RTK Query cache
    async function cacheAUser(store: ReturnType<typeof setupStore>) {
      succeed({ _id: 'previous' })
      await store.dispatch(api.endpoints.usersMe.initiate()).unwrap()
      expect(api.endpoints.usersMe.select()(store.getState()).data).toEqual({ _id: 'previous' })
    }

    it('is gone once someone signs in or up', async () => {
      const { store, client } = setup()
      await cacheAUser(store)
      succeed({ accessToken: 'jwt' })
      await client.signIn({ email: 'a@b.co', password: 'Pa$$w0rd' })
      expect(api.endpoints.usersMe.select()(store.getState()).data).toBeUndefined()

      await cacheAUser(store)
      succeed({ accessToken: 'jwt' })
      await client.signUp({
        name: 'Alice Smith',
        email: 'a@b.co',
        password: 'Pa$$w0rd',
        acceptedPrivacyVersion: '2026-10-13'
      })
      expect(api.endpoints.usersMe.select()(store.getState()).data).toBeUndefined()
    })

    it('is gone once the player signs out', async () => {
      const { store, client } = setup()
      await cacheAUser(store)
      succeed()

      await client.signOut()

      expect(api.endpoints.usersMe.select()(store.getState()).data).toBeUndefined()
    })
  })

  describe('signing in and up', () => {
    it('signs in and keeps the access token', async () => {
      const { store, client } = setup()
      succeed({ accessToken: 'jwt' })

      expect(await client.signIn({ email: 'a@b.co', password: 'Pa$$w0rd' })).toEqual({ ok: true })
      expect(requestOf()).toMatchObject({ url: '/api/v1/auth/login', method: 'POST', body: { email: 'a@b.co' } })
      expect(store.getState().session.token).toBe('jwt')
    })

    it('reports the code and text of a failed sign in', async () => {
      const { store, client } = setup()
      fail(401, { code: 'INVALID_CREDENTIALS', error: 'Wrong email or password' })

      expect(await client.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
        ok: false,
        failure: { code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' }
      })
      expect(store.getState().session.token).toBeNull()
    })

    it('reports a failure that has no body', async () => {
      const { client } = setup()
      query.mockResolvedValueOnce({ error: { status: 'FETCH_ERROR', error: 'down' } })

      expect(await client.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
        ok: false,
        failure: { code: undefined, message: undefined }
      })
    })

    it('signs up and keeps the access token', async () => {
      const { store, client } = setup()
      succeed({ accessToken: 'jwt' })

      expect(
        await client.signUp({
          name: 'Jon',
          email: 'a@b.co',
          password: 'Pa$$w0rd',
          acceptedPrivacyVersion: '2026-10-13'
        })
      ).toEqual({ ok: true })
      expect(requestOf().url).toBe('/api/v1/auth/register')
      expect(store.getState().session.token).toBe('jwt')
    })

    it('reports a failed sign up', async () => {
      const { client } = setup()
      fail(409, { code: 'EMAIL_TAKEN' })

      expect(
        await client.signUp({ name: 'Jon', email: 'a@b.co', password: 'x', acceptedPrivacyVersion: '2026-10-13' })
      ).toMatchObject({
        ok: false,
        failure: { code: 'EMAIL_TAKEN' }
      })
    })
  })

  describe('signing out', () => {
    it('ends the session on the server and locally', async () => {
      const { store, client } = setup()
      localStorage.setItem('token', 'jwt')
      const withToken = setupStore()
      const signedIn = createLocalAuthClient(withToken)
      succeed('')

      await signedIn.signOut()

      expect(requestOf().url).toBe('/api/v1/auth/logout')
      expect(withToken.getState().session.token).toBeNull()
      expect(store).toBeDefined()
      expect(client).toBeDefined()
    })

    it('ends the session locally even when the server cannot be reached', async () => {
      const { store, client } = setup()
      fail(500)

      await client.signOut()

      expect(store.getState().session.token).toBeNull()
    })
  })

  describe('refreshing', () => {
    it('keeps and returns the new access token', async () => {
      const { store, client } = setup()
      succeed({ accessToken: 'fresh' })

      expect(await client.refresh()).toBe('fresh')
      expect(requestOf().url).toBe('/api/v1/auth/refresh')
      expect(store.getState().session.token).toBe('fresh')
    })

    it('never takes the cookie of the admin over in a view of a player', async () => {
      sessionStorage.setItem('viewAs', JSON.stringify({ token: 'viewer', expiresAt: 1, playerName: 'Alice' }))
      const { client } = setup()

      expect(await client.refresh()).toBeNull()
      expect(query).not.toHaveBeenCalled()
      sessionStorage.clear()
    })

    it('ends the session when the refresh is refused', async () => {
      const { store, client } = setup()
      fail(401)

      expect(await client.refresh()).toBeNull()
      expect(store.getState().session.token).toBeNull()
    })
  })

  describe('account operations', () => {
    const cases: [keyof AuthClient, unknown[], string, unknown][] = [
      ['verifyEmail', ['tok'], '/api/v1/auth/email/verify', { token: 'tok' }],
      ['resendVerification', ['a@b.co'], '/api/v1/auth/email/resend', { email: 'a@b.co' }],
      ['requestPasswordReset', ['a@b.co'], '/api/v1/auth/password/forgot', { email: 'a@b.co' }],
      ['resetPassword', ['tok', 'New$ecr3t'], '/api/v1/auth/password/reset', { token: 'tok', password: 'New$ecr3t' }],
      [
        'changePassword',
        ['old', 'new'],
        '/api/v1/auth/password/change',
        { currentPassword: 'old', newPassword: 'new' }
      ],
      ['requestEmailChange', ['pw', 'n@b.co'], '/api/v1/auth/email/change', { password: 'pw', newEmail: 'n@b.co' }],
      ['confirmEmailChange', ['tok'], '/api/v1/auth/email/change/confirm', { token: 'tok' }],
      ['requestAccountDeletion', ['pw'], '/api/v1/auth/account/delete', { password: 'pw' }],
      ['confirmAccountDeletion', ['tok'], '/api/v1/auth/account/delete/confirm', { token: 'tok' }]
    ]

    it.each(cases)('%s posts to its endpoint', async (method, args, url, body) => {
      const { client } = setup()
      succeed('')

      const result = await (client[method] as (...a: unknown[]) => Promise<unknown>)(...args)

      expect(result).toEqual({ ok: true })
      expect(requestOf()).toMatchObject({ url, method: 'POST', body })
    })

    it.each(cases)('%s reports a failure', async (method, args) => {
      const { client } = setup()
      fail(400, { code: 'VALIDATION_FAILED' })

      const result = await (client[method] as (...a: unknown[]) => Promise<unknown>)(...args)

      expect(result).toMatchObject({ ok: false, failure: { code: 'VALIDATION_FAILED' } })
    })
  })
})
