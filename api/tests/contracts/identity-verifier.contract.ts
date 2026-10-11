import { IdentityVerifier } from '../../src/auth/application/identity-verifier'
import { Identity } from '../../src/auth/domain/identity'

export interface VerifierFixture {
  verifier: IdentityVerifier
  validToken: string
  // The fields the identity of `validToken` must have
  expected: Omit<Identity, 'sessionId'>
}

// Every IdentityVerifier adapter (custom, hosted, fake) has to pass these (AGENTS.md §3.3)
export function identityVerifierContract(name: string, createFixture: () => Promise<VerifierFixture>) {
  describe(`${name} fulfils the IdentityVerifier contract`, () => {
    it('turns a valid token into the identity of its owner', async () => {
      const { verifier, validToken, expected } = await createFixture()

      await expect(verifier.verify(validToken)).resolves.toMatchObject(expected)
    })

    it.each(['', 'garbage', 'a.b.c'])('rejects the invalid token %p with an AppError', async (token) => {
      const { verifier } = await createFixture()

      await expect(verifier.verify(token)).rejects.toMatchObject({ statusCode: 401 })
    })
  })
}
