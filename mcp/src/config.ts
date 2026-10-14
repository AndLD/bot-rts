export type Transport = 'stdio' | 'http'

export interface McpConfig {
  // The address of the game's API, without a trailing slash
  apiUrl: string
  // The key the server acts with; over HTTP each client may bring its own in the Authorization header
  apiKey: string | undefined
  transport: Transport
  http: { host: string; port: number }
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
  }
}

type Env = Record<string, string | undefined>

// BOTRTS_API_URL, BOTRTS_API_KEY (required for stdio), MCP_TRANSPORT (stdio | http), MCP_HOST, MCP_PORT
export function loadConfig(env: Env): McpConfig {
  const problems: string[] = []
  const transport = (env.MCP_TRANSPORT || 'stdio') as Transport
  const apiKey = env.BOTRTS_API_KEY || undefined
  const port = env.MCP_PORT === undefined || env.MCP_PORT === '' ? 3000 : Number(env.MCP_PORT)

  if (transport !== 'stdio' && transport !== 'http') {
    problems.push('MCP_TRANSPORT must be stdio or http')
  }
  if (transport === 'stdio' && !apiKey) {
    problems.push('BOTRTS_API_KEY is required: create an API key in the account page of the game')
  }
  if (apiKey && !apiKey.startsWith('botrts_')) {
    problems.push('BOTRTS_API_KEY does not look like an API key (botrts_…)')
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('MCP_PORT must be an integer between 0 and 65535')
  }
  if (problems.length) {
    throw new ConfigError(problems)
  }

  return {
    apiUrl: (env.BOTRTS_API_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    apiKey,
    transport,
    http: { host: env.MCP_HOST || '127.0.0.1', port }
  }
}
