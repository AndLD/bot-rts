import { readFileSync } from 'fs'
import { join } from 'path'
import request from 'supertest'
import { ADMIN_ROLES, AdminPermission, AdminRole, hasPermission } from '../../../lib/utils/admin'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'

// Every route under /api/v1/admin, read from the OpenAPI document, against everyone who may knock on it (design §25.2): the result
// of each must be what the permissions of the role say, and every call that changes something must leave a line in the audit trail.
// A new admin route that forgot its guard fails here without anyone writing a test for it.

interface Operation {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  url: string
  // The permission the route needs, or null for the routes any admin may use before the second factor (2fa)
  permission: AdminPermission | null
}

const ANY_ADMIN = 'any admin role'
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

function adminOperations(): Operation[] {
  const spec = JSON.parse(readFileSync(join(__dirname, '..', '..', 'openapi.json'), 'utf8')) as {
    paths: Record<string, Record<string, { 'x-admin-permission'?: string }>>
  }

  return Object.entries(spec.paths)
    .filter(([path]) => path.startsWith('/api/v1/admin/'))
    .flatMap(([path, operations]) =>
      METHODS.filter((method) => operations[method]).map((method) => {
        const permission = operations[method]['x-admin-permission']
        if (!permission) {
          throw new Error(`${method.toUpperCase()} ${path} names no admin permission`)
        }

        return {
          method,
          path,
          url: path.replace(/\{version\}/g, '1').replace(/\{[^}]+\}/g, ZERO_UUID),
          permission: permission === ANY_ADMIN ? null : (permission as AdminPermission)
        }
      })
    )
}

const OPERATIONS = adminOperations()
const GUARDED = OPERATIONS.filter((operation) => operation.permission !== null)
const label = ({ method, path }: Operation) => `${method.toUpperCase()} ${path}`

let database: TestDatabase
let testApp: TestApp
const admins = {} as Record<AdminRole, SignedUp>
let player: SignedUp
let unverified: SignedUp
let apiKeySecret: string

const send = (operation: Operation, token?: string) => {
  const call = request(testApp.url)[operation.method](operation.url)
  const authorized = token ? call.set({ Authorization: `Bearer ${token}` }) : call

  return operation.method === 'get' ? authorized : authorized.send({})
}
const auditCount = () => database.client.adminAuditEntry.count()

beforeAll(async () => {
  database = await createTestDatabase()
  // The dev tools are on, so that their routes are part of the matrix
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '1000000', DEV_TOOLS_ENABLED: 'true' })
  for (const role of ADMIN_ROLES) {
    admins[role] = await signUpAdmin(testApp, database, role)
  }
  player = await signUpVerified(testApp, database, 'player-matrix@example.com', 'Player')
  unverified = await signUpVerified(testApp, database, 'unverified-matrix@example.com', 'Unverified')
  await database.client.user.update({ where: { id: unverified.userId }, data: { status: 'admin' } })
  const created = await request(testApp.url)
    .post('/api/v1/api-keys')
    .set({ Authorization: `Bearer ${admins.owner.accessToken}` })
    .send({ name: 'Matrix', scopes: ['read'] })
    .expect(201)
  apiKeySecret = created.body.secret
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('the routes of the console', () => {
  it('are found in the OpenAPI document, each with a permission', () => {
    expect(OPERATIONS.length).toBeGreaterThan(50)
    expect(GUARDED.length).toBeGreaterThan(40)
  })
})

describe('the authorization matrix', () => {
  it.each(OPERATIONS.map((operation) => [label(operation), operation] as const))(
    '%s refuses a stranger, a player, a key and an admin without the second factor',
    async (_name, operation) => {
      expect((await send(operation)).status).toBe(401)
      expect((await send(operation, 'garbage')).status).toBe(401)
      expect((await send(operation, player.accessToken)).status).toBe(403)
      const withKey = await send(operation, apiKeySecret)
      // A route that opts in to admin keys answers a player key with the missing scope instead
      expect(withKey.status).toBe(403)
      expect(['SESSION_ONLY', 'API_KEY_SCOPE']).toContain(withKey.body.code)
      if (operation.permission) {
        expect((await send(operation, unverified.accessToken)).status).toBe(403)
      }
    }
  )

  it.each(GUARDED.map((operation) => [label(operation), operation] as const))(
    '%s lets in exactly the roles that hold its permission',
    async (_name, operation) => {
      for (const role of ADMIN_ROLES) {
        const { status } = await send(operation, admins[role].accessToken)

        if (hasPermission(role, operation.permission as AdminPermission)) {
          // Past the guards it may answer anything the route answers: 400 for the empty request, 404, or 503 while no engine runs
          expect([role, [401, 403, 500].includes(status)]).toEqual([role, false])
        } else {
          expect([role, status]).toEqual([role, 403])
        }
      }
    }
  )
})

describe('the audit trail', () => {
  const mutating = GUARDED.filter((operation) => operation.method !== 'get')
  const holder = (operation: Operation) =>
    ADMIN_ROLES.find((role) => hasPermission(role, operation.permission as AdminPermission)) as AdminRole

  it('has mutating routes to check', () => {
    expect(mutating.length).toBeGreaterThan(25)
  })

  it.each(mutating.map((operation) => [label(operation), operation] as const))(
    '%s writes a line when it runs, whatever the result',
    async (_name, operation) => {
      const role = holder(operation)
      const before = await auditCount()

      await send(operation, admins[role].accessToken)

      expect(await auditCount()).toBe(before + 1)
      const entry = await database.client.adminAuditEntry.findFirstOrThrow({ orderBy: { at: 'desc' } })
      expect([entry.actorId, entry.actorRole]).toEqual([admins[role].userId, role])
      expect(['success', 'failed']).toContain(entry.outcome)
    }
  )

  it.each(mutating.map((operation) => [label(operation), operation] as const))(
    '%s writes a line when it is refused',
    async (_name, operation) => {
      const before = await auditCount()

      await send(operation, player.accessToken)

      expect(await auditCount()).toBe(before + 1)
      const entry = await database.client.adminAuditEntry.findFirstOrThrow({ orderBy: { at: 'desc' } })
      expect([entry.actorId, entry.outcome, entry.action]).toEqual([player.userId, 'denied', operation.permission])
    }
  )
})
