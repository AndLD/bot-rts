import { CallHandler, ExecutionContext } from '@nestjs/common'
import { lastValueFrom, Observable, of, throwError, timer } from 'rxjs'
import { RequestTimeoutError } from '../domain/errors'
import { RequestTimeoutInterceptor } from './request-timeout.interceptor'

const context = {} as ExecutionContext
const handler = (stream: Observable<unknown>) => ({ handle: () => stream }) as CallHandler

describe('RequestTimeoutInterceptor', () => {
  it('passes an answer that comes in time', async () => {
    await expect(lastValueFrom(new RequestTimeoutInterceptor(100).intercept(context, handler(of('ok'))))).resolves.toBe(
      'ok'
    )
  })

  it('cuts off a handler that is too slow', async () => {
    const slow = handler(timer(200))

    await expect(lastValueFrom(new RequestTimeoutInterceptor(20).intercept(context, slow))).rejects.toBeInstanceOf(
      RequestTimeoutError
    )
  })

  it('does not disguise the errors of the handler', async () => {
    const failing = handler(throwError(() => new Error('bad')))

    await expect(lastValueFrom(new RequestTimeoutInterceptor(100).intercept(context, failing))).rejects.toThrow('bad')
  })
})
