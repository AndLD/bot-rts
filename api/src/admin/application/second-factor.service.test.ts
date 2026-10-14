import { FakeClock } from '../../../tests/fakes/fakes'
import { ValidationError } from '../../shared/domain/errors'
import { TwoFactorInvalidError } from '../domain/admin.errors'
import { SecondFactor } from '../domain/second-factor'
import { AesSecretCipher } from '../infrastructure/aes-secret-cipher'
import { CryptoRecoveryCodes } from '../infrastructure/crypto-recovery-codes'
import { CryptoTotp, totpCodeAt } from '../infrastructure/crypto-totp'
import { SecondFactorRepository } from './ports'
import { SecondFactorService } from './second-factor.service'

class InMemorySecondFactors implements SecondFactorRepository {
  factors = new Map<string, SecondFactor>()
  verifications = new Map<string, Date>()

  async find(userId: string) {
    return this.factors.get(userId) ?? null
  }
  async save(factor: SecondFactor) {
    this.factors.set(factor.userId, factor)
  }
  async findSessionVerification(sessionId: string) {
    return this.verifications.get(sessionId) ?? null
  }
  async saveSessionVerification(sessionId: string, verifiedAt: Date) {
    this.verifications.set(sessionId, verifiedAt)
  }
}

const TTL = 60 * 60 * 1000

function setup() {
  const repository = new InMemorySecondFactors()
  const clock = new FakeClock()
  const service = new SecondFactorService(
    repository,
    new CryptoTotp(),
    new AesSecretCipher('k'),
    new CryptoRecoveryCodes(),
    clock,
    { issuer: 'BotRTS', verificationTtlMs: TTL, recoveryCodeCount: 3 }
  )
  const nowMs = () => clock.now().getTime()
  const advance = (ms: number) => (clock.current = new Date(nowMs() + ms))

  return { repository, clock, service, nowMs, advance }
}

async function enrolled(ctx: ReturnType<typeof setup>) {
  const { secret } = await ctx.service.beginEnrollment('u1', 'a@b.c')
  const recoveryCodes = await ctx.service.confirmEnrollment('u1', 's1', totpCodeAt(secret, ctx.nowMs()))

  return { secret, recoveryCodes }
}

describe('SecondFactorService enrollment', () => {
  it('starts with a pending secret that does not protect the account yet', async () => {
    const ctx = setup()
    const enrollment = await ctx.service.beginEnrollment('u1', 'a@b.c')

    expect(enrollment.otpauthUrl).toContain(enrollment.secret)
    expect(ctx.repository.factors.get('u1')?.secretEncrypted).not.toContain(enrollment.secret)
    expect(await ctx.service.status('u1', 's1')).toEqual({ isEnrolled: false, isVerified: false })
  })

  it('switches on with the first valid code, shows recovery codes and verifies the session', async () => {
    const ctx = setup()
    const { recoveryCodes } = await enrolled(ctx)

    expect(recoveryCodes).toHaveLength(3)
    expect(ctx.repository.factors.get('u1')?.recoveryCodeHashes).toHaveLength(3)
    expect(JSON.stringify([...ctx.repository.factors.values()])).not.toContain(recoveryCodes[0])
    expect(await ctx.service.status('u1', 's1')).toEqual({ isEnrolled: true, isVerified: true })
  })

  it('rejects a wrong code, a second begin when enabled, and a confirm without enrollment', async () => {
    const ctx = setup()
    await expect(ctx.service.confirmEnrollment('u1', 's1', '123456')).rejects.toThrow(ValidationError)
    await ctx.service.beginEnrollment('u1', 'a@b.c')
    await expect(ctx.service.confirmEnrollment('u1', 's1', '000000')).rejects.toThrow(TwoFactorInvalidError)
    await enrolled(ctx).catch(() => undefined)
    const ready = setup()
    await enrolled(ready)
    await expect(ready.service.beginEnrollment('u1', 'a@b.c')).rejects.toThrow(ValidationError)
    await expect(ready.service.confirmEnrollment('u1', 's1', '123456')).rejects.toThrow(ValidationError)
  })
})

describe('SecondFactorService verification', () => {
  it('verifies another session with a fresh code and refuses to accept the same step twice', async () => {
    const ctx = setup()
    const { secret } = await enrolled(ctx)

    await expect(ctx.service.verifySession('u1', 's2', totpCodeAt(secret, ctx.nowMs()))).rejects.toThrow(
      TwoFactorInvalidError
    )
    ctx.advance(30_000)
    await ctx.service.verifySession('u1', 's2', totpCodeAt(secret, ctx.nowMs()))

    expect(await ctx.service.isSessionVerified('s2')).toBe(true)
    await expect(ctx.service.verifySession('u1', 's3', totpCodeAt(secret, ctx.nowMs()))).rejects.toThrow(
      TwoFactorInvalidError
    )
    expect(await ctx.service.isSessionVerified('s3')).toBe(false)
  })

  it('lets a recovery code in once', async () => {
    const ctx = setup()
    const { recoveryCodes } = await enrolled(ctx)

    await ctx.service.verifySession('u1', 's2', recoveryCodes[0].toUpperCase())
    expect(await ctx.service.isSessionVerified('s2')).toBe(true)
    expect(ctx.repository.factors.get('u1')?.recoveryCodeHashes).toHaveLength(2)
    await expect(ctx.service.verifySession('u1', 's3', recoveryCodes[0])).rejects.toThrow(TwoFactorInvalidError)
  })

  it('expires a verification and needs an enabled factor', async () => {
    const ctx = setup()
    await expect(ctx.service.verifySession('u1', 's1', '123456')).rejects.toThrow(ValidationError)
    await enrolled(ctx)

    expect(await ctx.service.isSessionVerified('s1')).toBe(true)
    ctx.advance(TTL + 1)
    expect(await ctx.service.isSessionVerified('s1')).toBe(false)
    expect(await ctx.service.status('u1', 's1')).toEqual({ isEnrolled: true, isVerified: false })
    expect(await ctx.service.isSessionVerified(undefined)).toBe(false)
  })

  it('works without a session id (a provider without sessions) by verifying nothing', async () => {
    const ctx = setup()
    const { secret } = await ctx.service.beginEnrollment('u1', 'a@b.c')
    await ctx.service.confirmEnrollment('u1', undefined, totpCodeAt(secret, ctx.nowMs()))

    expect(ctx.repository.verifications.size).toBe(0)
  })
})
