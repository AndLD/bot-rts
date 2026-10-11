import { CryptoSecretGenerator } from './crypto-secret-generator'

describe('CryptoSecretGenerator', () => {
  const generator = new CryptoSecretGenerator()

  it('generates long distinct URL-safe secrets', () => {
    const [a, b] = [generator.generate(), generator.generate()]

    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  it('hashes deterministically and one way', () => {
    expect(generator.hash('x')).toBe(generator.hash('x'))
    expect(generator.hash('x')).not.toBe(generator.hash('y'))
    expect(generator.hash('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})
