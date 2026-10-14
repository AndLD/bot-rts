import { Clock } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { TwoFactorInvalidError } from '../domain/admin.errors'
import { isEnabled, isVerificationFresh, SecondFactor } from '../domain/second-factor'
import { RecoveryCodes, SecondFactorRepository, SecretCipher, Totp } from './ports'

export interface SecondFactorPolicy {
  issuer: string
  // How long a session stays verified
  verificationTtlMs: number
  recoveryCodeCount: number
}

export interface SecondFactorStatus {
  isEnrolled: boolean
  isVerified: boolean
}

export interface Enrollment {
  secret: string
  otpauthUrl: string
}

// Mandatory TOTP for every admin (design §25.2): enroll, confirm the first code, then verify each session
export class SecondFactorService {
  constructor(
    private readonly factors: SecondFactorRepository,
    private readonly totp: Totp,
    private readonly cipher: SecretCipher,
    private readonly recovery: RecoveryCodes,
    private readonly clock: Clock,
    private readonly policy: SecondFactorPolicy
  ) {}

  async status(userId: string, sessionId: string | undefined): Promise<SecondFactorStatus> {
    const factor = await this.factors.find(userId)

    return { isEnrolled: isEnabled(factor), isVerified: isEnabled(factor) && (await this.isSessionVerified(sessionId)) }
  }

  async isSessionVerified(sessionId: string | undefined): Promise<boolean> {
    if (!sessionId) {
      return false
    }

    return isVerificationFresh(
      await this.factors.findSessionVerification(sessionId),
      this.clock.now(),
      this.policy.verificationTtlMs
    )
  }

  // Creates a pending secret; an enabled factor is never replaced from here
  async beginEnrollment(userId: string, account: string): Promise<Enrollment> {
    if (isEnabled(await this.factors.find(userId))) {
      throw new ValidationError('Two-factor authentication is already enabled')
    }

    const secret = this.totp.generateSecret()
    await this.factors.save({
      userId,
      secretEncrypted: this.cipher.encrypt(secret),
      createdAt: this.clock.now(),
      enabledAt: null,
      lastUsedStep: null,
      recoveryCodeHashes: []
    })

    return { secret, otpauthUrl: this.totp.otpauthUrl({ secret, account, issuer: this.policy.issuer }) }
  }

  // The first valid code switches the factor on; the recovery codes are shown once, here
  async confirmEnrollment(userId: string, sessionId: string | undefined, code: string): Promise<string[]> {
    const factor = await this.factors.find(userId)

    if (!factor || isEnabled(factor)) {
      throw new ValidationError('There is no enrollment to confirm')
    }

    const step = this.acceptedStep(factor, code)
    const codes = this.recovery.generate(this.policy.recoveryCodeCount)
    const now = this.clock.now()

    await this.factors.save({
      ...factor,
      enabledAt: now,
      lastUsedStep: step,
      recoveryCodeHashes: codes.map((item) => this.recovery.hash(item))
    })
    await this.markVerified(sessionId, now)

    return codes
  }

  // A TOTP code or a recovery code (used up by it) marks the session as verified
  async verifySession(userId: string, sessionId: string | undefined, code: string): Promise<void> {
    const factor = await this.factors.find(userId)

    if (!isEnabled(factor)) {
      throw new ValidationError('Two-factor authentication is not set up')
    }

    if (/^\d{6}$/.test(code)) {
      const step = this.acceptedStep(factor, code)
      await this.factors.save({ ...factor, lastUsedStep: step })
    } else {
      const hash = this.recovery.hash(code.trim().toLowerCase())
      if (!factor.recoveryCodeHashes.includes(hash)) {
        throw new TwoFactorInvalidError()
      }
      await this.factors.save({ ...factor, recoveryCodeHashes: factor.recoveryCodeHashes.filter((h) => h !== hash) })
    }

    await this.markVerified(sessionId, this.clock.now())
  }

  private acceptedStep(factor: SecondFactor, code: string): number {
    const step = this.totp.verify(this.cipher.decrypt(factor.secretEncrypted), code, this.clock.now().getTime())

    if (step === null || (factor.lastUsedStep !== null && step <= factor.lastUsedStep)) {
      throw new TwoFactorInvalidError()
    }

    return step
  }

  private async markVerified(sessionId: string | undefined, at: Date): Promise<void> {
    if (sessionId) {
      await this.factors.saveSessionVerification(sessionId, at)
    }
  }
}
