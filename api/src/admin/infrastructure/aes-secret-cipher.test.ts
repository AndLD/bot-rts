import { AesSecretCipher } from './aes-secret-cipher'
import { CryptoRecoveryCodes } from './crypto-recovery-codes'

describe('AesSecretCipher', () => {
  it('round-trips a secret and does not store it in the clear', () => {
    const cipher = new AesSecretCipher('key')
    const encrypted = cipher.encrypt('JBSWY3DPEHPK3PXP')

    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP')
    expect(cipher.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP')
    expect(cipher.encrypt('JBSWY3DPEHPK3PXP')).not.toBe(encrypted)
  })

  it('refuses another key and a tampered value', () => {
    const encrypted = new AesSecretCipher('key').encrypt('secret')
    const [iv, tag, body] = encrypted.split('.')

    expect(() => new AesSecretCipher('other').decrypt(encrypted)).toThrow()
    expect(() => new AesSecretCipher('key').decrypt([iv, tag, Buffer.from('x').toString('base64')].join('.'))).toThrow()
    expect(body).toBeDefined()
  })
})

describe('CryptoRecoveryCodes', () => {
  const codes = new CryptoRecoveryCodes()

  it('generates distinct readable codes and hashes them deterministically', () => {
    const generated = codes.generate(8)

    expect(new Set(generated).size).toBe(8)
    expect(generated[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/)
    expect(codes.hash(generated[0])).toBe(codes.hash(generated[0]))
    expect(codes.hash(generated[0])).not.toBe(codes.hash(generated[1]))
    expect(codes.hash(generated[0])).not.toContain(generated[0])
  })
})
