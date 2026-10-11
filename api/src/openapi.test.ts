import { readFileSync } from 'fs'
import { join } from 'path'
import { createOpenApiSpec } from './openapi'

const HOW_TO_FIX = 'The API changed: run `npm run openapi:generate -w api` and commit api/openapi.json'

describe('the OpenAPI document', () => {
  let generated: string

  beforeAll(async () => {
    generated = await createOpenApiSpec()
  })

  it('is the committed api/openapi.json (the web client is generated from it)', () => {
    const committed = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8')

    expect({ upToDate: committed === generated, hint: HOW_TO_FIX }).toEqual({ upToDate: true, hint: HOW_TO_FIX })
  })

  it('describes the versioned routes, each with an operation id of its own', () => {
    const spec = JSON.parse(generated)
    const operations = Object.entries<Record<string, { operationId: string }>>(spec.paths).flatMap(([path, methods]) =>
      Object.values(methods).map((operation) => ({ path, id: operation.operationId }))
    )

    expect(operations.length).toBeGreaterThan(25)
    expect(operations.every(({ path }) => path.startsWith('/api/v1/'))).toBe(true)
    expect(new Set(operations.map(({ id }) => id)).size).toBe(operations.length)
    expect(operations.map(({ id }) => id)).toEqual(expect.arrayContaining(['authLogin', 'botsDeployBase', 'usersMe']))
  })

  it('knows how to sign in and what a failed request looks like', () => {
    const spec = JSON.parse(generated)

    expect(spec.components.securitySchemes).toMatchObject({
      bearer: { type: 'http' },
      cookie: { type: 'apiKey', name: 'refreshToken' }
    })
    expect(spec.components.schemas.ErrorResponseModel.required).toEqual(['statusCode', 'code', 'error'])
    expect(spec.paths['/api/v1/auth/login'].post.responses.default).toBeDefined()
  })
})
