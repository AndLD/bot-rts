#!/usr/bin/env node
import { ConfigError, loadConfig } from './config'
import { start } from './start'

// stdio: add it to an MCP client as the command `node ts-built/mcp/src/index.js` with BOTRTS_API_KEY in its environment.
// HTTP: MCP_TRANSPORT=http; every client brings its own key in the Authorization header.
async function main() {
  try {
    const running = await start(loadConfig(process.env))
    if (running.address) {
      console.error(`bot-rts MCP server listening on ${running.address}`)
    }
    process.on('SIGTERM', () => void running.stop().then(() => process.exit(0)))
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : error)
    process.exit(1)
  }
}

void main()
