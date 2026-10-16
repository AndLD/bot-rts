import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { ApiClient, ApiError } from './api-client'
import { NO_TELEMETRY, Telemetry } from './telemetry'
import { allTools } from './tools'
import { ToolDefinition } from './tools/types'

export const SERVER_NAME = 'bot-rts'
export const SERVER_VERSION = '0.0.0'

interface ToolResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

const text = (value: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError } : {})
})

// The game's refusals are results the AI can read and act on, not protocol errors: the code is the stable part
export function describeFailure(error: unknown): string {
  if (error instanceof ApiError) {
    const hint =
      error.code === 'API_KEY_SCOPE'
        ? ' The API key of this server does not allow it; ask the player for a key with the scope named above.'
        : error.code === 'TOO_MANY_REQUESTS'
          ? ' The key used up its rate limit; wait a little before the next call.'
          : ''
    return `${error.code}: ${error.message}${hint}`
  }
  return `ERROR: ${(error as Error).message}`
}

// The SDK infers the callback from the input schema, which for schemas made at run time (the generated tools) is too deep for the
// compiler; the schemas are checked by the SDK when a call arrives, so the registration is typed by what this server needs
type RegisterTool = (
  name: string,
  config: {
    title: string
    description: string
    inputSchema: ZodRawShapeCompat
    annotations: { readOnlyHint: boolean; openWorldHint: boolean }
  },
  callback: (input: unknown) => Promise<ToolResult>
) => unknown

function register(server: McpServer, client: ApiClient, tool: ToolDefinition, telemetry: Telemetry): void {
  const registerTool = server.registerTool as unknown as RegisterTool

  registerTool.call(
    server,
    tool.name,
    {
      title: tool.title,
      description: `${tool.description} (API key scope: ${tool.scope}.)`,
      inputSchema: tool.inputSchema as unknown as ZodRawShapeCompat,
      annotations: { readOnlyHint: tool.isReadOnly, openWorldHint: false }
    },
    async (input: unknown): Promise<ToolResult> => {
      return telemetry.tool(tool.name, async () => {
        try {
          const result = await tool.run(client, input)
          return text(JSON.stringify(result ?? null, null, 2))
        } catch (error) {
          const failure = describeFailure(error)
          telemetry.logger.error(`${tool.name} failed: ${failure}`)
          return text(failure, true)
        }
      })
    }
  )
}

// An MCP server that plays as the player of the API key behind `client`. It knows nothing the API does not tell it.
export function createServer(
  client: ApiClient,
  tools: ToolDefinition[] = allTools,
  telemetry: Telemetry = NO_TELEMETRY
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'You play Bot RTS as a regular player through its public API. Call list_bots first to learn the ids. ' +
        'Actions cost energy and operations, and a refusal such as NO_ENERGY or BLOCKED is a normal answer to react to. ' +
        'Write scripts with write_file and run them with run_script; read what they printed with get_terminal_history.'
    }
  )

  tools.forEach((tool) => register(server, client, tool, telemetry))

  return server
}
