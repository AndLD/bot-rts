// Writes the OpenAPI document of the API to openapi.json (run: npm run openapi:generate -w api). CI fails when the
// committed file differs from what the controllers and DTOs describe (see src/openapi.test.ts).
import { writeFileSync } from 'fs'
import { join } from 'path'
import { createOpenApiSpec } from '../src/openapi'

createOpenApiSpec()
  .then((spec) => writeFileSync(join(__dirname, '..', 'openapi.json'), spec))
  .catch((error) => {
    process.stderr.write(`${error}\n`)
    process.exit(1)
  })
