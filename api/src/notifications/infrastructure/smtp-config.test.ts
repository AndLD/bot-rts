import { readSmtpConfig } from './smtp-config'

describe('readSmtpConfig', () => {
  const credentials = { SMTP_USER: 'user', SMTP_PASS: 'pass' }

  it('returns undefined without credentials', () => {
    expect(readSmtpConfig({})).toBeUndefined()
    expect(readSmtpConfig({ SMTP_USER: 'user' })).toBeUndefined()
    expect(readSmtpConfig({ SMTP_PASS: 'pass' })).toBeUndefined()
  })

  it('defaults to Gmail over TLS outside production', () => {
    expect(readSmtpConfig(credentials)).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'user',
      pass: 'pass'
    })
  })

  it('requires an explicit host in production', () => {
    expect(readSmtpConfig({ ...credentials, NODE_ENV: 'production' })).toBeUndefined()
    expect(readSmtpConfig({ ...credentials, NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com' })?.host).toBe(
      'smtp.example.com'
    )
  })

  it('reads port and secure flag from the environment', () => {
    expect(readSmtpConfig({ ...credentials, SMTP_PORT: '587', SMTP_SECURE: 'false' })).toMatchObject({
      port: 587,
      secure: false
    })
    expect(readSmtpConfig({ ...credentials, SMTP_PORT: '587' })).toMatchObject({ port: 587, secure: false })
    expect(readSmtpConfig({ ...credentials, SMTP_PORT: '587', SMTP_SECURE: 'true' })).toMatchObject({ secure: true })
  })

  it('rejects an invalid port', () => {
    expect(readSmtpConfig({ ...credentials, SMTP_PORT: 'abc' })).toBeUndefined()
    expect(readSmtpConfig({ ...credentials, SMTP_PORT: '-1' })).toBeUndefined()
  })
})
