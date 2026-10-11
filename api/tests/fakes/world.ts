import { SpawnService } from '../../src/spawn/application/spawn.service'
import { DEFAULT_SPAWN_CONFIG, SpawnConfig } from '../../src/spawn/domain/spawn-config'
import { BaseLifecycle } from '../../src/bots/application/base-lifecycle'
import { BotsService } from '../../src/bots/application/bots.service'
import { EnergyService } from '../../src/modules/application/energy.service'
import { EnergyModel } from '../../src/modules/domain/energy-model'
import { ModuleFactory } from '../../src/modules/application/module.factory'
import { createModuleRegistry } from '../../src/modules/domain/module-registry'
import { FilesService } from '../../src/files/application/files.service'
import { MapGenerator } from '../../src/map/domain/map-generator'
import { MapService } from '../../src/map/application/map.service'
import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../../src/map/domain/world-config'
import { createTerminalShell } from '../../src/terminal/application/shell/create-terminal-shell'
import { TerminalService } from '../../src/terminal/application/terminal.service'
import { DEFAULT_TERMINAL_RETENTION, TerminalRetention } from '../../src/terminal/domain/terminal-retention'
import { Rng } from '../../src/shared/application/rng'
import {
  FakeClock,
  FakeHasher,
  FakeUnitOfWork,
  FixedRng,
  InMemoryAuthTokenRepository,
  InMemoryBotRepository,
  InMemoryCredentialRepository,
  InMemoryIdentityRepository,
  InMemorySessionRepository,
  InMemoryFileRepository,
  InMemoryMapRepository,
  InMemorySpawnSeedRepository,
  InMemoryModuleRepository,
  InMemoryTerminalSessionRepository,
  InMemoryUserRepository,
  SequentialIdGenerator
} from './fakes'

// Everything a use-case test needs, wired with fakes
export function createWorld(
  options: {
    rng?: Rng
    config?: Partial<WorldConfig>
    spawn?: Partial<SpawnConfig>
    retention?: Partial<TerminalRetention>
  } = {}
) {
  const repositories = {
    users: new InMemoryUserRepository(),
    bots: new InMemoryBotRepository(),
    modules: new InMemoryModuleRepository(),
    files: new InMemoryFileRepository(),
    map: new InMemoryMapRepository(),
    spawnSeeds: new InMemorySpawnSeedRepository(),
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

  const terminalSessions = new InMemoryTerminalSessionRepository()
  const moduleFactory = new ModuleFactory(ids)
  const moduleRegistry = createModuleRegistry()
  const spawnConfig = { ...DEFAULT_SPAWN_CONFIG, ...options.spawn }
  const spawnService = new SpawnService(rng, clock, spawnConfig)
  const botsService = new BotsService(
    unitOfWork,
    repositories.bots,
    repositories.modules,
    ids,
    clock,
    new FakeHasher(),
    moduleFactory,
    new BaseLifecycle(moduleRegistry),
    spawnService
  )
  const filesService = new FilesService(unitOfWork, botsService, repositories.files, ids, moduleRegistry)
  const terminalService = new TerminalService(terminalSessions, botsService, ids, clock, {
    ...DEFAULT_TERMINAL_RETENTION,
    ...options.retention
  })
  return {
    repositories,
    terminalSessions,
    unitOfWork,
    clock,
    ids,
    config,
    spawnConfig,
    spawnService,
    mapService: new MapService(unitOfWork, ids, new MapGenerator(rng, config), clock, config.chunkSize),
    botsService,
    moduleFactory,
    moduleRegistry,
    energyService: new EnergyService(repositories.modules, new EnergyModel(moduleRegistry)),
    filesService,
    terminalService,
    terminalShell: createTerminalShell(botsService, filesService, terminalService)
  }
}
