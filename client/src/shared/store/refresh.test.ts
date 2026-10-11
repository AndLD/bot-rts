import { refreshOnce } from './refresh'

describe('refreshOnce', () => {
  it('shares one running refresh between simultaneous callers', async () => {
    const run = jest.fn(() => Promise.resolve('token'))

    const results = await Promise.all([refreshOnce(run), refreshOnce(run)])

    expect(results).toEqual(['token', 'token'])
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('starts a new refresh once the previous one has finished', async () => {
    const run = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')

    expect(await refreshOnce(run)).toBe('first')
    expect(await refreshOnce(run)).toBe('second')
  })
})
