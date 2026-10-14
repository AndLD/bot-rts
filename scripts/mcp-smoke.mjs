// Plays a few tools of the built MCP server over stdio against a running game, the way an MCP client does.
// Usage: node scripts/mcp-smoke.mjs <api-url> <api-key> <bot-id>
// Prints one JSON object with the text each tool answered. Used by the end-to-end specs (client/cypress/e2e/mcp.cy.ts).
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const [apiUrl, apiKey, botId] = process.argv.slice(2)
const root = resolve(import.meta.dirname, '..')

if (!apiUrl || !apiKey || !botId) {
  console.error('Usage: node scripts/mcp-smoke.mjs <api-url> <api-key> <bot-id>')
  process.exit(2)
}

const client = new Client({ name: 'smoke', version: '1' })
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, 'mcp/ts-built/mcp/src/index.js')],
    env: { PATH: process.env.PATH ?? '', BOTRTS_API_URL: apiUrl, BOTRTS_API_KEY: apiKey }
  })
)

const textOf = (result) => result.content[0].text
const answers = {}
for (const [label, name, args] of [
  ['bots', 'list_bots', {}],
  ['scan', 'bot_scan', { botId }],
  ['move', 'bot_move', { botId, cells: 1 }],
  ['denied', 'write_file', { botId, driveId: 'x', path: 'a.js', content: '1' }]
]) {
  const result = await client.callTool({ name, arguments: args })
  answers[label] = { isError: result.isError === true, text: textOf(result) }
}

await client.close()
console.log(JSON.stringify(answers))
