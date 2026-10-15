// Dev tools of the admin console (design §25.3): test players with bases, for a development or test server. Not available in
// production.

// The most test players one request creates
export const DEV_TOOLS_MAX_PLAYERS = 20

// Every test player has an email in this domain, which is how they are found again
export const TEST_EMAIL_DOMAIN = 'devtools.test'

export interface ITestPlayer {
  userId: string
  email: string
  // To sign in as the test player
  password: string
  // To connect to the base
  botPassword: string
  // Null when no base could be placed
  baseId: string | null
}

export interface ISeedWorldResult {
  players: ITestPlayer[]
}

export interface IRemoveTestPlayersResult {
  removed: number
}

export interface IDevToolsStatus {
  isEnabled: boolean
}
