#!/usr/bin/env node
import { ConfigError, loadConfig } from './config'
import { start } from './start'
import { createTelemetry } from './telemetry'

// stdio: add it to an MCP client as the command `node ts-built/mcp/src/index.js` with BOTRTS_API_KEY in its environment.
// HTTP: MCP_TRANSPORT=http; every client brings its own key in the Authorization header.
// Traces and logs go to the OTLP gateway when OTEL_EXPORTER_OTLP_ENDPOINT is set.
async function main() {
  const telemetry = createTelemetry(process.env)
  try {
    const running = await start(loadConfig(process.env), undefined, telemetry)
    if (running.address) {
      telemetry.logger.info(`bot-rts MCP server listening on ${running.address}`)
    }
    process.on(
      'SIGTERM',
      () =>
        void running
          .stop()
          .then(() => telemetry.shutdown())
          .then(() => process.exit(0))
    )
  } catch (error) {
    telemetry.logger.error(error instanceof ConfigError ? error.message : String(error))
    await telemetry.shutdown()
    process.exit(1)
  }
}

void main()
