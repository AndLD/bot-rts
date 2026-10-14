import { createHash, randomBytes } from 'crypto'
import { API_KEY_PREFIX } from '../../../../lib/utils/interfaces/api-keys'
import { KeySecrets } from '../application/key-secrets'

// 256 random bits make a fast hash enough: there is nothing to guess, so no work factor is needed (unlike a password)
export class CryptoKeySecrets implements KeySecrets {
  generate(): string {
    return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex')
  }
}
