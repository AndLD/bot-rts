import { BotRepository } from '../../bots/application/bot.repository'
import { FileRepository } from '../../files/application/file.repository'
import { MapRepository } from '../../map/application/map.repository'
import { ModuleRepository } from '../../modules/application/module.repository'
import { SpawnSeedRepository } from '../../spawn/application/spawn-seed.repository'
import { UserRepository } from '../../users/application/user.repository'
import {
  AuthTokenRepository,
  CredentialRepository,
  IdentityRepository,
  SessionRepository
} from '../../auth/application/ports'

export const UNIT_OF_WORK = Symbol('UnitOfWork')

export interface Repositories {
  users: UserRepository
  bots: BotRepository
  modules: ModuleRepository
  files: FileRepository
  map: MapRepository
  spawnSeeds: SpawnSeedRepository
  identities: IdentityRepository
  credentials: CredentialRepository
  sessions: SessionRepository
  authTokens: AuthTokenRepository
}

export interface UnitOfWork {
  // Runs `work` in one transaction: the repositories it receives commit or roll back together
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>
}
