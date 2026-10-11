import { buildOpenApiDocument, createApp } from './app.factory'
import { loadConfig } from './config/app-config'

// The OpenAPI document as the text kept in openapi.json. The application is created but never listens, and the
// database is never connected.
export async function createOpenApiSpec(): Promise<string> {
  const app = await createApp(
    loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi' })
  )

  try {
    return `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`
  } finally {
    await app.close()
  }
}
