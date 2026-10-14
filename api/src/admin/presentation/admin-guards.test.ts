import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of, throwError } from 'rxjs'
import { FakeClock, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { AppConfig } from '../../config/app-config'
import { ForbiddenError } from '../../shared/domain/errors'
import { runWithRequestId } from '../../shared/application/request-context'
import { AuditService } from '../application/audit.service'
import { AuditLog } from '../application/ports'
import { SecondFactorService } from '../application/second-factor.service'
import { AuditEntry } from '../domain/audit-entry'
import { AdminAccessGuard } from './admin-access.guard'
import { ADMIN_ONLY_KEY, ADMIN_PERMISSION_KEY, AUDIT_KEY } from './admin-permission.decorator'
import { AuditInterceptor } from './audit.interceptor'

class RecordingAuditLog implements AuditLog {
  entries: AuditEntry[] = []
  async append(entry: AuditEntry) {
    this.entries.push(entry)
  }
  async list() {
    return { entries: this.entries, total: this.entries.length }
  }
}

function setup(metadata: Record<string, unknown>, ipAllowList: string[] = []) {
  const log = new RecordingAuditLog()
  const audit = new AuditService(log, new SequentialIdGenerator(), new FakeClock())
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector

  return { log, audit, reflector, config: { admin: { ipAllowList } } as unknown as AppConfig }
}

function contextOf(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext
}

const principal = (status: 'moderator' | 'user' = 'moderator') => ({
  user: buildUser({ status }),
  identity: { sessionId: 's1' }
})

describe('AdminAccessGuard', () => {
  const verified = (isVerified: boolean) =>
    ({ isSessionVerified: async () => isVerified }) as unknown as SecondFactorService

  it('lets routes that name no permission through', async () => {
    const { audit, reflector, config } = setup({})
    const guard = new AdminAccessGuard(reflector, verified(false), audit, config)

    expect(await guard.canActivate(contextOf({}))).toBe(true)
  })

  it('lets a verified admin with the permission in', async () => {
    const { audit, reflector, config, log } = setup({ [ADMIN_PERMISSION_KEY]: 'players.ban' })
    const guard = new AdminAccessGuard(reflector, verified(true), audit, config)

    expect(await guard.canActivate(contextOf({ principal: principal(), ip: '1.1.1.1' }))).toBe(true)
    expect(log.entries).toEqual([])
  })

  it('refuses and audits a missing permission, a missing factor and a non-admin', async () => {
    const lacking = setup({ [ADMIN_PERMISSION_KEY]: 'balance.write' })
    await expect(
      new AdminAccessGuard(lacking.reflector, verified(true), lacking.audit, lacking.config).canActivate(
        contextOf({ principal: principal() })
      )
    ).rejects.toThrow(ForbiddenError)
    expect(lacking.log.entries[0]).toMatchObject({ action: 'balance.write', outcome: 'denied', ip: null })

    const unverified = setup({ [ADMIN_PERMISSION_KEY]: 'players.ban' })
    await expect(
      new AdminAccessGuard(unverified.reflector, verified(false), unverified.audit, unverified.config).canActivate(
        contextOf({ principal: principal() })
      )
    ).rejects.toThrow('Two-factor')

    const player = setup({ [ADMIN_ONLY_KEY]: true })
    await expect(
      new AdminAccessGuard(player.reflector, verified(true), player.audit, player.config).canActivate(
        contextOf({ principal: principal('user') })
      )
    ).rejects.toThrow(ForbiddenError)
    expect(player.log.entries[0].action).toBe('admin.access')
  })

  it('lets an any-admin route through before the factor is verified', async () => {
    const { audit, reflector, config } = setup({ [ADMIN_ONLY_KEY]: true })
    const guard = new AdminAccessGuard(reflector, verified(false), audit, config)

    expect(await guard.canActivate(contextOf({ principal: principal() }))).toBe(true)
  })

  it('holds the console to the allow-list of addresses when there is one', async () => {
    const { audit, reflector, config } = setup({ [ADMIN_PERMISSION_KEY]: 'players.ban' }, ['10.0.0.1'])
    const guard = new AdminAccessGuard(reflector, verified(true), audit, config)

    expect(await guard.canActivate(contextOf({ principal: principal(), ip: '10.0.0.1' }))).toBe(true)
    await expect(guard.canActivate(contextOf({ principal: principal(), ip: '10.0.0.2' }))).rejects.toThrow(
      'not available from this address'
    )
    await expect(guard.canActivate(contextOf({ principal: principal() }))).rejects.toThrow(
      'not available from this address'
    )
  })
})

describe('AuditInterceptor', () => {
  const request = (method: string, extra: Record<string, unknown> = {}) => ({
    method,
    route: { path: '/api/v1/admin/things/:id' },
    params: { id: 'thing-1' },
    principal: principal(),
    ip: '2.2.2.2',
    ...extra
  })

  it('does not audit other routes and plain reads', async () => {
    const other = setup({})
    const read = setup({ [ADMIN_PERMISSION_KEY]: 'players.read' })

    await lastValueFrom(
      new AuditInterceptor(other.reflector, other.audit).intercept(contextOf(request('POST')), { handle: () => of(1) })
    )
    await lastValueFrom(
      new AuditInterceptor(read.reflector, read.audit).intercept(contextOf(request('GET')), { handle: () => of(1) })
    )

    expect(other.log.entries).toEqual([])
    expect(read.log.entries).toEqual([])
  })

  it('audits a change that has no detail and no named target with empty fields', async () => {
    const { reflector, audit, log } = setup({ [ADMIN_PERMISSION_KEY]: 'players.ban' })

    await lastValueFrom(
      new AuditInterceptor(reflector, audit).intercept(contextOf(request('POST', { ip: undefined })), {
        handle: () => of(1)
      })
    )

    expect(log.entries[0]).toMatchObject({
      ip: null,
      targetType: null,
      targetId: null,
      reason: null,
      before: null,
      after: null
    })
  })

  it('audits a change under the method and route, with the detail the handler filled in', async () => {
    const { reflector, audit, log } = setup({ [ADMIN_PERMISSION_KEY]: 'players.ban' })
    const detailed = request('PUT', {
      auditDetail: { reason: 'spam', before: { a: 1 }, after: { a: 2 }, targetType: 'player', targetId: 'p1' }
    })

    const result = await runWithRequestId('req-1', () =>
      lastValueFrom(new AuditInterceptor(reflector, audit).intercept(contextOf(detailed), { handle: () => of('done') }))
    )

    expect(result).toBe('done')
    expect(log.entries[0]).toMatchObject({
      action: 'PUT /api/v1/admin/things/:id',
      outcome: 'success',
      targetType: 'player',
      targetId: 'p1',
      reason: 'spam',
      before: { a: 1 },
      after: { a: 2 },
      requestId: 'req-1',
      ip: '2.2.2.2'
    })
  })

  it('audits a sensitive read by its name and target parameter, and a failure as failed', async () => {
    const { reflector, audit, log } = setup({
      [ADMIN_PERMISSION_KEY]: 'inspector.files.read',
      [AUDIT_KEY]: { action: 'inspector.files.read', targetType: 'file', targetParam: 'id' }
    })
    const interceptor = new AuditInterceptor(reflector, audit)

    await lastValueFrom(interceptor.intercept(contextOf(request('GET')), { handle: () => of(1) }))
    await expect(
      lastValueFrom(
        interceptor.intercept(contextOf(request('GET')), { handle: () => throwError(() => new Error('x')) })
      )
    ).rejects.toThrow('x')

    expect(
      log.entries.map((entry) => [entry.action, entry.outcome, entry.targetType, entry.targetId, entry.requestId])
    ).toEqual([
      ['inspector.files.read', 'success', 'file', 'thing-1', null],
      ['inspector.files.read', 'failed', 'file', 'thing-1', null]
    ])
  })
})

describe('AuditService', () => {
  it('stamps an id and the time on a record and lists through the port', async () => {
    const { audit, log } = setup({})
    const entry = await audit.record({
      actorId: 'a',
      actorRole: 'owner',
      action: 'x',
      outcome: 'success',
      targetType: null,
      targetId: null,
      reason: null,
      before: null,
      after: null,
      ip: null,
      requestId: null
    })

    expect(entry.id).toBeTruthy()
    expect(entry.at).toEqual(new FakeClock().now())
    expect((await audit.list({}, { page: 1, pageSize: 10 })).entries).toEqual(log.entries)
  })
})
