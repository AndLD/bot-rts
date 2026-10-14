import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs'
import { RequestTimeoutError } from '../domain/errors'

// A handler that has not answered in time is cut off with 503 REQUEST_TIMEOUT, so a stuck dependency cannot pile up requests.
// The work already started is not cancelled (the engine and the database finish it); only the wait ends.
@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error) => throwError(() => (error instanceof TimeoutError ? new RequestTimeoutError() : error)))
    )
  }
}
