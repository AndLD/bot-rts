import { ExecutionContext } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'
import { AssistantOutputInterceptor } from './assistant-output.interceptor'

const run = (principal: unknown) =>
  lastValueFrom(
    new AssistantOutputInterceptor().intercept(
      { switchToHttp: () => ({ getRequest: () => ({ principal }) }) } as unknown as ExecutionContext,
      { handle: () => of({ message: 'mail alice@example.com' }) }
    )
  )

describe('AssistantOutputInterceptor', () => {
  it('redacts what an admin key gets back', async () => {
    expect(await run({ apiKey: { scopes: ['admin:logs:read'] } })).toEqual({ message: 'mail [email]' })
  })

  it('leaves a session and a player key alone', async () => {
    expect(await run({})).toEqual({ message: 'mail alice@example.com' })
    expect(await run({ apiKey: { scopes: ['read'] } })).toEqual({ message: 'mail alice@example.com' })
    expect(await run(undefined)).toEqual({ message: 'mail alice@example.com' })
  })
})
