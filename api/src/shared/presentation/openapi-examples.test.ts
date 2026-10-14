import type { OpenAPIObject } from '@nestjs/swagger'
import { addExamples, exampleOfSchema } from './openapi-examples'

const document = (paths: object, schemas: object = {}) =>
  ({ openapi: '3.0.0', info: { title: 't', version: '1' }, paths, components: { schemas } }) as unknown as OpenAPIObject

describe('exampleOfSchema', () => {
  const doc = document(
    {},
    {
      Point: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer', minimum: 5 } } },
      Loop: { type: 'object', properties: { again: { $ref: '#/components/schemas/Loop' } } }
    }
  )

  it('prefers what the schema says: an example, a default, the first enum value', () => {
    expect(exampleOfSchema({ type: 'string', example: 'ALPHA-7K2' }, doc)).toBe('ALPHA-7K2')
    expect(exampleOfSchema({ type: 'integer', default: 120 }, doc)).toBe(120)
    expect(exampleOfSchema({ type: 'string', enum: ['read', 'files'] }, doc)).toBe('read')
  })

  it('makes the plainest value of each type', () => {
    expect(exampleOfSchema({ type: 'string' }, doc)).toBe('string')
    expect(exampleOfSchema({ type: 'string', format: 'uuid' }, doc)).toMatch(/^0{8}-/)
    expect(exampleOfSchema({ type: 'string', format: 'date-time' }, doc)).toBe('2026-01-01T00:00:00.000Z')
    expect(exampleOfSchema({ type: 'string', format: 'email' }, doc)).toBe('player@example.com')
    expect(exampleOfSchema({ type: 'integer' }, doc)).toBe(1)
    expect(exampleOfSchema({ type: 'number', minimum: 3 }, doc)).toBe(3)
    expect(exampleOfSchema({ type: 'boolean' }, doc)).toBe(false)
    expect(exampleOfSchema({ type: 'array', items: { type: 'string' } }, doc)).toEqual(['string'])
    expect(exampleOfSchema(undefined, doc)).toBeNull()
  })

  it('follows references and combines allOf, taking the first of oneOf and anyOf', () => {
    expect(exampleOfSchema({ $ref: '#/components/schemas/Point' }, doc)).toEqual({ x: 1, y: 5 })
    expect(
      exampleOfSchema(
        { allOf: [{ $ref: '#/components/schemas/Point' }, { type: 'object', properties: { z: { type: 'boolean' } } }] },
        doc
      )
    ).toEqual({ x: 1, y: 5, z: false })
    expect(exampleOfSchema({ oneOf: [{ type: 'boolean' }, { type: 'string' }] }, doc)).toBe(false)
    expect(exampleOfSchema({ anyOf: [{ type: 'string' }] }, doc)).toBe('string')
  })

  it('stops at a schema that contains itself', () => {
    const value = exampleOfSchema({ $ref: '#/components/schemas/Loop' }, doc)

    expect(JSON.stringify(value)).toContain('again')
    expect(JSON.stringify(value).length).toBeLessThan(400)
  })
})

type Found = {
  requestBody: { content: Record<string, { example?: unknown }> }
  responses: Record<string, { content: Record<string, { example?: unknown }> }>
  'x-codeSamples': Array<{ source: string }>
}
const operationsOf = (paths: OpenAPIObject['paths']) =>
  paths['/api/v1/bots/{botId}/scan'] as unknown as Record<'post' | 'get', Found>

describe('addExamples', () => {
  const spec = () =>
    document(
      {
        '/api/v1/bots/{botId}/scan': {
          post: {
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Scan' } } } },
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'array', items: { type: 'string' } } } } },
              default: { content: { 'application/json': { schema: { type: 'string' } } } }
            }
          },
          get: {
            responses: {
              '200': { description: 'no body' },
              '201': { content: { 'application/json': { example: 'mine', schema: {} } } }
            }
          }
        }
      },
      { Scan: { type: 'object', properties: { radius: { type: 'integer', default: 4 } } } }
    )

  it('adds a request and a response example and a curl sample to every operation, but not to the error response', () => {
    const { paths } = addExamples(spec())
    const post = operationsOf(paths).post

    expect(post.requestBody.content['application/json'].example).toEqual({ radius: 4 })
    expect(post.responses['200'].content['application/json'].example).toEqual(['string'])
    expect(post.responses.default.content['application/json'].example).toBeUndefined()
    expect(post['x-codeSamples'][0].source).toBe(
      [
        'curl -X POST "$BOTRTS_URL/api/v1/bots/00000000-0000-4000-8000-000000000000/scan" \\',
        '  -H "Authorization: Bearer $BOTRTS_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"radius":4}'`
      ].join('\n')
    )
  })

  it('keeps an example the code wrote, and gives an operation without a body a plain curl', () => {
    const { paths } = addExamples(spec())
    const get = operationsOf(paths).get

    expect(get.responses['201'].content['application/json'].example).toBe('mine')
    expect(get['x-codeSamples'][0].source).toBe(
      'curl -X GET "$BOTRTS_URL/api/v1/bots/00000000-0000-4000-8000-000000000000/scan" \\\n  -H "Authorization: Bearer $BOTRTS_KEY"'
    )
  })
})
