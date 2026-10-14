import { AddressInfo } from 'node:net'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ApiClient, Fetch } from './api-client'
import { McpConfig } from './config'
import { createMcpHttpServer } from './http-server'
import { createServer } from './server'

export interface Running {
  // Where it listens (HTTP) or null (stdio)
  address: string | null
  stop(): Promise<void>
}

// Starts the server the configuration asks for. stdio talks over the standard streams of this process; HTTP listens on a port.
export async function start(config: McpConfig, fetchImpl?: Fetch): Promise<Running> {
  if (config.transport === 'stdio') {
    const server = createServer(new ApiClient(config.apiUrl, config.apiKey as string, fetchImpl))
    await server.connect(new StdioServerTransport())

    return { address: null, stop: () => server.close() }
  }

  const http = createMcpHttpServer(config, fetchImpl)
  await new Promise<void>((resolve) => http.listen(config.http.port, config.http.host, resolve))
  const { port } = http.address() as AddressInfo

  return {
    address: `http://${config.http.host}:${port}/mcp`,
    stop: () => new Promise((resolve) => http.close(() => resolve()))
  }
}
