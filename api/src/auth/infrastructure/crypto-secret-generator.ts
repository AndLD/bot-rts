import { createHash, randomBytes } from 'crypto'
import { SecretGenerator } from '../application/ports'

export class CryptoSecretGenerator implements SecretGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url')
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex')
  }
}
