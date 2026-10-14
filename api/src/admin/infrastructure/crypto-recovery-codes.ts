import { createHash, randomBytes } from 'crypto'
import { RecoveryCodes } from '../application/ports'

// Ten lowercase hex characters, grouped for reading: `a1b2c-3d4e5`
export class CryptoRecoveryCodes implements RecoveryCodes {
  generate(count: number): string[] {
    return Array.from({ length: count }, () => {
      const hex = randomBytes(5).toString('hex')
      return `${hex.slice(0, 5)}-${hex.slice(5)}`
    })
  }

  hash(code: string): string {
    return createHash('sha256').update(code).digest('hex')
  }
}
