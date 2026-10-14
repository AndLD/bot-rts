import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { of } from 'rxjs'
import { DEPRECATION_KEY, DeprecationInterceptor } from './api-deprecation'

function run(deprecation: unknown) {
  const headers: Record<string, string> = {}
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getResponse: () => ({ setHeader: (name: string, value: string) => (headers[name] = value) })
    })
  } as unknown as ExecutionContext
  const reflector = {
    getAllAndOverride: (key: string) => (key === DEPRECATION_KEY ? deprecation : undefined)
  } as unknown as Reflector
  const next: CallHandler = { handle: () => of('body') }
  const result = new DeprecationInterceptor(reflector).intercept(context, next)
  return { headers, result }
}

describe('DeprecationInterceptor', () => {
  it('tells the client that a route is deprecated, when it goes, and what replaces it', () => {
    const { headers, result } = run({ sunset: '2027-06-30', replacement: '/api/v2/bots' })

    expect(headers).toEqual({
      Deprecation: 'true',
      Sunset: 'Wed, 30 Jun 2027 00:00:00 GMT',
      Link: '</api/v2/bots>; rel="successor-version"'
    })
    result.subscribe((value) => expect(value).toBe('body'))
  })

  it('omits the link when there is no replacement', () => {
    expect(run({ sunset: '2027-06-30' }).headers.Link).toBeUndefined()
  })

  it('leaves a route that is not deprecated alone', () => {
    expect(run(undefined).headers).toEqual({})
  })
})
