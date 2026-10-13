import { siteMessages } from './siteMessages'

describe('siteMessages', () => {
  it('carries only the texts the public pages use', () => {
    expect(Object.keys(siteMessages('en'))).toEqual(expect.arrayContaining(['common', 'site', 'marketing']))
    expect(siteMessages('en')).not.toHaveProperty('auth')
  })

  it('shows English where Russian lacks a text', () => {
    expect(siteMessages('ru').site).toMatchObject({ login: 'Войти' })
    expect(siteMessages('ru').common).toMatchObject({ appName: 'Bot RTS' })
  })
})
