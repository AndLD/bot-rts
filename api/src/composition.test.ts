import { createServices } from './composition'

describe('createServices', () => {
  it('wires every service; no connection is opened until a query runs', async () => {
    const services = createServices(
      { DATABASE_URL: 'postgresql://x:y@localhost:1/none', WORLD_SEED: '7' },
      'http://front'
    )

    expect(Object.keys(services).sort()).toEqual(['bots', 'close', 'mapService', 'scan', 'users', 'verificationMailer'])
    await expect(services.close()).resolves.toBeUndefined()
  })

  it('closes the SMTP sender too when email is configured', async () => {
    const services = createServices(
      {
        DATABASE_URL: 'postgresql://x:y@localhost:1/none',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        SMTP_HOST: 'smtp.example.com'
      },
      'http://front'
    )

    await expect(services.close()).resolves.toBeUndefined()
  })
})
