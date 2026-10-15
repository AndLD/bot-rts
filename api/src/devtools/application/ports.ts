export const TEST_PLAYER_DIRECTORY = Symbol('TestPlayerDirectory')

// Finds the accounts the dev tools made
export interface TestPlayerDirectory {
  // The ids of test players that are not erased yet
  activeIds(limit: number): Promise<string[]>
}
