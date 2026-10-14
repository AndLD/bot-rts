import { CryptoTotp, totpCodeAt } from './crypto-totp'

// RFC 6238 appendix B: the SHA-1 secret "12345678901234567890", whose code at 59 s is 94287082 (the last six digits are used)
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('CryptoTotp', () => {
  const totp = new CryptoTotp()

  it('produces the RFC 6238 code', () => {
    expect(totpCodeAt(RFC_SECRET, 59_000)).toBe('287082')
  })

  it('generates base32 secrets of 160 bits that differ', () => {
    const secret = totp.generateSecret()

    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(totp.generateSecret()).not.toBe(secret)
  })

  it('accepts the code of the current step and one step either side, and returns the step', () => {
    const now = 1_000_000_000
    const step = Math.floor(now / 30_000)

    expect(totp.verify(RFC_SECRET, totpCodeAt(RFC_SECRET, now), now)).toBe(step)
    expect(totp.verify(RFC_SECRET, totpCodeAt(RFC_SECRET, now - 30_000), now)).toBe(step - 1)
    expect(totp.verify(RFC_SECRET, totpCodeAt(RFC_SECRET, now + 30_000), now)).toBe(step + 1)
  })

  it('rejects an older or wrong code', () => {
    const now = 1_000_000_000

    expect(totp.verify(RFC_SECRET, totpCodeAt(RFC_SECRET, now - 90_000), now)).toBeNull()
    expect(totp.verify(RFC_SECRET, '000000', now)).toBeNull()
  })

  it('builds the address an authenticator app scans', () => {
    const url = totp.otpauthUrl({ secret: RFC_SECRET, account: 'a@b.c', issuer: 'Bot RTS' })

    expect(url).toBe(`otpauth://totp/Bot%20RTS%3Aa%40b.c?secret=${RFC_SECRET}&issuer=Bot%20RTS&digits=6&period=30`)
  })
})
