import { createHmac, randomBytes } from 'crypto'
import { Totp } from '../application/ports'

const STEP_SECONDS = 30
const DIGITS = 6
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Only whole groups of five bytes are encoded (a secret is 20 bytes = 32 characters), so there is no padding
function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  return out
}

function base32Decode(text: string): Buffer {
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of text) {
    value = (value << 5) | BASE32.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function codeAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', secret).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 15
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits), the profile every authenticator app supports
export class CryptoTotp implements Totp {
  generateSecret(): string {
    return base32Encode(randomBytes(20))
  }

  otpauthUrl({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
    const label = encodeURIComponent(`${issuer}:${account}`)

    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`
  }

  verify(secret: string, code: string, nowMs: number): number | null {
    const key = base32Decode(secret)
    const current = Math.floor(nowMs / 1000 / STEP_SECONDS)

    for (const step of [current, current - 1, current + 1]) {
      if (codeAt(key, step) === code) {
        return step
      }
    }

    return null
  }
}

// Exposed for tests: the code an authenticator app would show
export function totpCodeAt(secret: string, nowMs: number): string {
  return codeAt(base32Decode(secret), Math.floor(nowMs / 1000 / STEP_SECONDS))
}
