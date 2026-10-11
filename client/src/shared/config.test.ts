describe('API_URL', () => {
  const original = process.env.NEXT_PUBLIC_API_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = original
    jest.resetModules()
  })

  it('comes from NEXT_PUBLIC_API_URL', async () => {
    expect((await import('./config')).API_URL).toBe('http://api.test')
  })

  it('defaults to the local development server', async () => {
    delete process.env.NEXT_PUBLIC_API_URL

    expect((await import('./config')).API_URL).toBe('http://localhost:8080')
  })
})
