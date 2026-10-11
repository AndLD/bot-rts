import jwt from 'jsonwebtoken'
import { UnauthorizedError } from '../../shared/domain/errors'
import { AccessTokenExpiredError } from '../domain/auth.errors'
import { JwtAccessTokenService } from './jwt-access-token.service'

const userId = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'
const sessionId = '1c8c5c1f-8e4b-4a1f-8b63-1a1c0b2d3e4f'

describe('JwtAccessTokenService', () => {
  const service = new JwtAccessTokenService('secret', 300)

  it('round-trips the user and the session and puts nothing else in the token', () => {
    const token = service.sign({ userId, sessionId })

    expect(service.verify(token)).toEqual({ userId, sessionId })
    expect(Object.keys(jwt.decode(token) as object).sort()).toEqual(['exp', 'iat', 'sid', 'sub'])
  })

  it('reports an expired token distinctly', () => {
    const expired = jwt.sign({ sid: sessionId }, 'secret', { subject: userId, expiresIn: -10 })

    expect(() => service.verify(expired)).toThrow(AccessTokenExpiredError)
  })

  it('rejects garbage, another secret, other algorithms and malformed claims', () => {
    const foreign = jwt.sign({ sid: sessionId }, 'other', { subject: userId })
    const unsigned = jwt.sign({ sid: sessionId }, '', { subject: userId, algorithm: 'none' })
    const badClaims = jwt.sign({ sid: 'nope' }, 'secret', { subject: userId })
    const noSubject = jwt.sign({ sid: sessionId }, 'secret')

    for (const token of ['garbage', foreign, unsigned, badClaims, noSubject]) {
      expect(() => service.verify(token)).toThrow(UnauthorizedError)
    }
  })
})
