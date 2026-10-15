import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { ForbiddenError } from '../../shared/domain/errors'
import { ViewAsReadOnlyError } from '../../auth/domain/view-as.errors'
import { ViewAsController } from './view-as.controller'
import { ViewAsAuditInterceptor } from './view-as-audit.interceptor'
import { ViewAsGuard } from './view-as.guard'
import { ViewAsSocketGateway } from './view-as-socket.gateway'

const view = { adminId: 'a1', adminStatus: 'admin', reason: 'r', expiresAt: new Date() }
const player = { id: 'p1' }

function context(request: object, metadata: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class'
  } as unknown as ExecutionContext
}

const reflectorWith = (metadata: Record<string, unknown>) =>
  ({ getAllAndOverride: (key: string) => metadata[key] }) as unknown as Reflector

describe('ViewAsGuard', () => {
  it.each([
    ['lets anyone else through', { method: 'POST', principal: { user: player } }, {}],
    ['lets a view read', { method: 'GET', principal: { user: player, viewAs: view } }, {}],
    ['lets a view leave', { method: 'POST', principal: { user: player, viewAs: view } }, { allowInViewAs: true }],
    ['lets an unauthenticated route through', { method: 'POST' }, {}]
  ])('%s', (_name, request, metadata) => {
    expect(new ViewAsGuard(reflectorWith(metadata)).canActivate(context(request))).toBe(true)
  })

  it('refuses a change in a view', () => {
    const guard = new ViewAsGuard(reflectorWith({}))

    expect(() => guard.canActivate(context({ method: 'PUT', principal: { user: player, viewAs: view } }))).toThrow(
      ViewAsReadOnlyError
    )
  })
})

describe('ViewAsAuditInterceptor', () => {
  const next: CallHandler = { handle: () => of('data') }

  it('writes the entry before the data leaves', async () => {
    const record = jest.fn().mockResolvedValue({})
    const interceptor = new ViewAsAuditInterceptor(reflectorWith({ viewAsAudit: 'files.read' }), { record } as never)
    const request = { principal: { user: player, viewAs: view }, originalUrl: '/x?path=a', ip: undefined }

    expect(await lastValueFrom(interceptor.intercept(context(request), next))).toBe('data')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'a1', action: 'view-as.files.read', targetId: 'p1', ip: null })
    )
  })

  it.each([
    ['a route that is not sensitive', {}, { principal: { user: player, viewAs: view } }],
    ['a caller that is not in a view', { viewAsAudit: 'files.read' }, { principal: { user: player } }]
  ])('writes nothing for %s', async (_name, metadata, request) => {
    const record = jest.fn()
    const interceptor = new ViewAsAuditInterceptor(reflectorWith(metadata), { record } as never)

    expect(await lastValueFrom(interceptor.intercept(context(request), next))).toBe('data')
    expect(record).not.toHaveBeenCalled()
  })
})

describe('ViewAsSocketGateway', () => {
  function connect(viewAs: unknown, record = jest.fn().mockResolvedValue({})) {
    let middleware: (packet: unknown[], next: () => void) => Promise<void> = async () => undefined
    const socket = {
      principal: { user: player, viewAs },
      handshake: { address: undefined },
      use: (fn: typeof middleware) => (middleware = fn)
    }
    new ViewAsSocketGateway({ record } as never).handleConnection(socket as never)

    return { send: middleware, record, installed: () => middleware }
  }

  it('does nothing for a connection that is not a view', () => {
    const socket = { principal: { user: player }, use: jest.fn() }
    new ViewAsSocketGateway({} as never).handleConnection(socket as never)

    expect(socket.use).not.toHaveBeenCalled()
  })

  it('lets reads through and audits the sensitive ones', async () => {
    const { send, record } = connect(view)
    const next = jest.fn()

    await send(['get-user-bases', jest.fn()], next)
    await send(['get-terminal-history', 'bot-1', 10, jest.fn()], next)
    await send(['get-terminal-history', 5, jest.fn()], next)

    expect(next).toHaveBeenCalledTimes(3)
    expect(record).toHaveBeenCalledTimes(2)
    expect(record.mock.calls[0][0]).toMatchObject({ actorId: 'a1', reason: 'bot-1', ip: null })
    expect(record.mock.calls[1][0]).toMatchObject({ reason: null })
  })

  it('answers every other event with the read-only error, and ignores a refusal that nobody waits for', async () => {
    const { send } = connect(view)
    const next = jest.fn()
    const ack = jest.fn()

    await send(['craft-module', 'b', 'gun', 1, ack], next)
    await send(['unknown-event'], next)

    expect(ack).toHaveBeenCalledWith(null, expect.objectContaining({ code: 403 }))
    expect(next).not.toHaveBeenCalled()
  })
})

describe('ViewAsController', () => {
  const principal = { user: player, identity: { sessionId: 's' }, viewAs: view }

  it('starts a view and tells the audit trail about it', async () => {
    const expiresAt = new Date(5000)
    const viewAs = {
      start: jest.fn().mockResolvedValue({ accessToken: 't', expiresAt, player: { id: 'p1', name: 'Pat' } })
    }
    const detail = {}

    const result = await new ViewAsController(viewAs as never).start({ user: { id: 'a1' } } as never, detail, 'p1', {
      reason: 'support'
    })

    expect(result).toEqual({ accessToken: 't', expiresAt: 5000, player: { _id: 'p1', name: 'Pat' } })
    expect(detail).toMatchObject({ targetType: 'player', targetId: 'p1', reason: 'support' })
  })

  it('leaves a view, and refuses to leave when there is none', async () => {
    const viewAs = { end: jest.fn().mockResolvedValue(undefined) }
    const controller = new ViewAsController(viewAs as never)

    await controller.exit(principal as never, { ip: '1.2.3.4' } as never)
    await controller.exit(principal as never, {} as never)
    expect(viewAs.end.mock.calls.map((call) => call[1])).toEqual(['1.2.3.4', null])

    await expect(controller.exit({ user: player } as never, {} as never)).rejects.toThrow(ForbiddenError)
  })
})
