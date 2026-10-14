import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ApiClient, Fetch } from './api-client'
import { McpConfig } from './config'
import { createServer } from './server'

const MAX_BODY_BYTES = 1024 * 1024

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('too large')
    }
    chunks.push(chunk as Buffer)
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
}

const jsonRpcError = (message: string) => ({ jsonrpc: '2.0', error: { code: -32000, message }, id: null })

// The key of a request: the one in its Authorization header, otherwise the one the server was started with. Every client of a hosted
// server thus plays as its own player, and the server holds no state between requests.
function keyOf(request: IncomingMessage, fallback: string | undefined): string | undefined {
  const header = request.headers.authorization
  const bearer = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined
  return bearer || fallback
}

// Streamable HTTP (stateless): POST /mcp carries each JSON-RPC message; GET /health is for the load balancer
export function createMcpHttpServer(config: McpConfig, fetchImpl?: Fetch): Server {
  return createHttpServer(async (request, response) => {
    const path = new URL(request.url as string, 'http://localhost').pathname

    if (path === '/health' && request.method === 'GET') {
      return reply(response, 200, { status: 'ok' })
    }
    if (path !== '/mcp') {
      return reply(response, 404, jsonRpcError('Not found'))
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return reply(response, 405, jsonRpcError('Method not allowed: this server is stateless, send POST'))
    }

    const key = keyOf(request, config.apiKey)
    if (!key) {
      return reply(response, 401, jsonRpcError('Send your API key as Authorization: Bearer botrts_…'))
    }

    let body: unknown
    try {
      body = await readBody(request)
    } catch (error) {
      return reply(
        response,
        error instanceof RangeError ? 413 : 400,
        jsonRpcError('The request body is not valid JSON')
      )
    }

    const server = createServer(new ApiClient(config.apiUrl, key, fetchImpl))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    response.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(request, response, body)
  })
}
