import type { OpenAPIObject } from '@nestjs/swagger'

type Schema = {
  $ref?: string
  type?: string
  format?: string
  example?: unknown
  default?: unknown
  enum?: unknown[]
  minimum?: number
  items?: Schema
  properties?: Record<string, Schema>
  allOf?: Schema[]
  oneOf?: Schema[]
  anyOf?: Schema[]
  additionalProperties?: boolean | Schema
}

type Operation = {
  summary?: string
  parameters?: Array<{ name: string; in: string; example?: unknown; schema?: Schema }>
  requestBody?: { content?: Record<string, { schema?: Schema; example?: unknown }> }
  responses?: Record<string, { content?: Record<string, { schema?: Schema; example?: unknown }> }>
  security?: unknown[]
  'x-codeSamples'?: unknown[]
}

const MAX_DEPTH = 5
const ZERO_UUID = '00000000-0000-4000-8000-000000000000'

// A value that satisfies a schema, taken from what the schema says (an example, a default, the first enum value) and otherwise
// the plainest value of its type
export function exampleOfSchema(schema: Schema | undefined, document: OpenAPIObject, depth = 0): unknown {
  if (!schema || depth > MAX_DEPTH) {
    return null
  }
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() as string
    return exampleOfSchema((document.components?.schemas?.[name] as Schema | undefined) ?? {}, document, depth + 1)
  }
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum?.length) return schema.enum[0]
  if (schema.allOf?.length) {
    return Object.assign({}, ...schema.allOf.map((part) => exampleOfSchema(part, document, depth + 1) as object))
  }
  const choice = schema.oneOf?.[0] ?? schema.anyOf?.[0]
  if (choice) return exampleOfSchema(choice, document, depth + 1)

  switch (schema.type) {
    case 'string':
      return schema.format === 'uuid'
        ? ZERO_UUID
        : schema.format === 'date-time'
          ? '2026-01-01T00:00:00.000Z'
          : schema.format === 'email'
            ? 'player@example.com'
            : 'string'
    case 'integer':
    case 'number':
      return schema.minimum ?? 1
    case 'boolean':
      return false
    case 'array':
      return [exampleOfSchema(schema.items, document, depth + 1)]
    default:
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([name, property]) => [
          name,
          exampleOfSchema(property, document, depth + 1)
        ])
      )
  }
}

const jsonOf = (content?: Record<string, { schema?: Schema; example?: unknown }>) => content?.['application/json']

// `https://host/api/v1/bots/{botId}` -> a curl command that a developer can adapt: the key in the header, a body when the
// operation takes one
function curlOf(method: string, path: string, operation: Operation, body: unknown): string {
  const pathWithExamples = path.replace(/\{[^}]+\}/g, ZERO_UUID)
  const lines = [
    `curl -X ${method.toUpperCase()} "$BOTRTS_URL${pathWithExamples}"`,
    `  -H "Authorization: Bearer $BOTRTS_KEY"`
  ]

  if (body !== undefined) {
    lines.push(`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(body)}'`)
  }
  return lines.join(' \\\n')
}

// Gives every operation of the document a request example, a response example and a curl sample, unless the code already
// wrote one: the generated reference is then usable without reading the DTOs (Phase 8.10)
export function addExamples(document: OpenAPIObject): OpenAPIObject {
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, Operation>)) {
      const request = jsonOf(operation.requestBody?.content)
      if (request && request.example === undefined) {
        request.example = exampleOfSchema(request.schema, document)
      }

      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        const json = jsonOf(response.content)
        if (json && json.example === undefined && /^2/.test(status)) {
          json.example = exampleOfSchema(json.schema, document)
        }
      }

      operation['x-codeSamples'] = [
        { lang: 'Shell', label: 'curl', source: curlOf(method, path, operation, request?.example) }
      ]
    }
  }

  return document
}
