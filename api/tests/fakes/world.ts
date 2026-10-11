import { BotsService } from '../../src/bots/application/bots.service'
import { MapGenerator } from '../../src/map/domain/map-generator'
import { MapService } from '../../src/map/application/map.service'
import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../../src/map/domain/world-config'
import { Rng } from '../../src/shared/application/rng'
import {
  FakeClock,
  FakeUnitOfWork,
  FixedRng,
  InMemoryAuthTokenRepository,
  InMemoryBotRepository,
  InMemoryCredentialRepository,
  InMemoryIdentityRepository,
  InMemorySessionRepository,
  InMemoryFileRepository,
  InMemoryMapRepository,
  InMemoryModuleRepository,
  InMemoryUserRepository,
  SequentialIdGenerator
} from './fakes'

// Everything a use-case test needs, wired with fakes
export function createWorld(options: { rng?: Rng; config?: Partial<WorldConfig> } = {}) {
  const repositories = {
    users: new InMemoryUserRepository(),
    bots: new InMemoryBotRepository(),
    modules: new InMemoryModuleRepository(),
    files: new InMemoryFileRepository(),
    map: new InMemoryMapRepository(),
    identities: new InMemoryIdentityRepository(),
    credentials: new InMemoryCredentialRepository(),
    sessions: new InMemorySessionRepository(),
    authTokens: new InMemoryAuthTokenRepository()
  }
  const unitOfWork = new FakeUnitOfWork(repositories)
  const ids = new SequentialIdGenerator()
  const clock = new FakeClock()
  const rng = options.rng ?? new FixedRng([0.5])
  const config = { ...DEFAULT_WORLD_CONFIG, ...options.config }

  return {
    repositories,
    unitOfWork,
    clock,
    ids,
    config,
    mapService: new MapService(unitOfWork, ids, new MapGenerator(rng, config), clock, config.chunkSize),
    botsService: new BotsService(unitOfWork, repositories.bots, repositories.modules, ids, rng, clock, config)
  }
}
