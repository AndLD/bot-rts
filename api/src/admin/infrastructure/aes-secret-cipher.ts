import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { SecretCipher } from '../application/ports'

// AES-256-GCM; the stored text is `iv.tag.ciphertext` in base64. The key is derived from a configured secret.
export class AesSecretCipher implements SecretCipher {
  private readonly key: Buffer

  constructor(secret: string) {
    this.key = createHash('sha256').update(`admin-two-factor:${secret}`).digest()
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

    return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.')
  }

  decrypt(encrypted: string): string {
    const [iv, tag, body] = encrypted.split('.').map((part) => Buffer.from(part, 'base64'))
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  }
}
