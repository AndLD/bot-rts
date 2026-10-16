import { IAdminApiKey } from '../../../lib/utils/admin-api-keys'
import { ApiClient } from '../api-client'
import { adminToolsFor } from './admin'
import { allTools } from './index'
import { ToolDefinition } from './types'

// The tools a key can use. A key with admin scopes (granted in the admin console) gets the admin tools its scopes allow, and nothing of
// the game; any other key, or a server that cannot tell (the API is down), gets the player tools. The API says what the key holds, so
// this server never guesses scopes.
export async function selectTools(client: ApiClient): Promise<ToolDefinition[]> {
  try {
    const admin = adminToolsFor(await client.get<IAdminApiKey>('/admin/api-keys/current'))

    return admin.length ? admin : allTools
  } catch {
    return allTools
  }
}
