import { BcryptPasswordHasher } from './bcrypt-password-hasher'

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher()

  it('hashes with a salt and verifies the password', async () => {
    const [a, b] = [await hasher.hash('Passw0rd!'), await hasher.hash('Passw0rd!')]

    expect(a).not.toBe(b)
    expect(await hasher.verify('Passw0rd!', a)).toBe(true)
    expect(await hasher.verify('wrong', a)).toBe(false)
  })
})
