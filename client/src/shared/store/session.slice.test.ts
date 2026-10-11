import { sessionSlice, setToken } from './session.slice'

describe('session slice', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  it('starts with the stored token', () => {
    localStorage.setItem('token', 'saved')

    expect(sessionSlice.getInitialState()).toEqual({ token: 'saved' })
  })

  it('starts without a token when none is stored', () => {
    expect(sessionSlice.getInitialState()).toEqual({ token: null })
  })

  it('starts without a token when the storage cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(sessionSlice.getInitialState()).toEqual({ token: null })
  })

  it('keeps a new token in the state and in the storage', () => {
    const state = sessionSlice.reducer({ token: null }, setToken('new'))

    expect(state.token).toBe('new')
    expect(localStorage.getItem('token')).toBe('new')
  })

  it('removes the token from the storage when the session ends', () => {
    localStorage.setItem('token', 'old')

    const state = sessionSlice.reducer({ token: 'old' }, setToken(null))

    expect(state.token).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('keeps the token in memory when the storage cannot be written', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(sessionSlice.reducer({ token: null }, setToken('new')).token).toBe('new')
  })
})
