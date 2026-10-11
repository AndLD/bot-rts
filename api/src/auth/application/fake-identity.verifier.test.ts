import { identityVerifierContract } from '../../../tests/contracts/identity-verifier.contract'
import { FakeIdentityVerifier } from '../../../tests/fakes/fake-identity-verifier'

identityVerifierContract('FakeIdentityVerifier', async () => {
  const verifier = new FakeIdentityVerifier()
  const identity = { provider: 'fake', subject: 'subject-1', email: 'fake@example.com', emailVerified: true }

  return { verifier, validToken: verifier.issue(identity), expected: identity }
})
