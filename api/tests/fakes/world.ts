import { BotsService } from '../../src/bots/application/bots.service'
import { MapService } from '../../src/map/application/map.service'
import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../../src/map/domain/world-config'
import { Rng } from '../../src/shared/application/rng'
import {
  FakeClock,
  FakeUnitOfWork,
  FixedRng,
  InMemoryBotRepository,
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
    map: new InMemoryMapRepository()
  }
  const unitOfWork = new FakeUnitOfWork(repositories)
  const ids = new SequentialIdGenerator()
  const clock = new FakeClock()
  const rng = options.rng ?? new FixedRng([0.5])
  const config = { ...DEFAULT_WORLD_CONFIG, ...options.config }

  return {
    repositories,
    clock,
    ids,
    config,
    mapService: new MapService(unitOfWork, ids, rng, clock, config),
    botsService: new BotsService(unitOfWork, repositories.bots, repositories.modules, ids, rng, clock, config)
  }
}
