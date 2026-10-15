import { buildOpenApiDocument, createApp } from './app.factory'
import { loadConfig } from './config/app-config'

// The OpenAPI document as the text kept in openapi.json. The application is created but never listens, and the
// database is never connected. The dev tools are on, so that their routes are in the document (a server without them answers 404).
export async function createOpenApiSpec(): Promise<string> {
  const app = await createApp(
    loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
      DEV_TOOLS_ENABLED: 'true'
    })
  )

  try {
    return `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`
  } finally {
    await app.close()
  }
}
