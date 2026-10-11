import { SpawnSeed, SpawnSeedMember } from '../domain/spawn-seed'

export interface SpawnSeedRepository {
  find(code: string): Promise<SpawnSeed | null>
  add(seed: SpawnSeed): Promise<void>
  membersOf(code: string): Promise<SpawnSeedMember[]>
  // Adds the player to the seed, or replaces the base they started with
  saveMember(member: SpawnSeedMember): Promise<void>
}
