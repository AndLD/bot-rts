import { SpawnService } from '../../src/spawn/application/spawn.service'
import { DEFAULT_SPAWN_CONFIG, SpawnConfig } from '../../src/spawn/domain/spawn-config'
import { BaseLifecycle } from '../../src/bots/application/base-lifecycle'
import { BotsService } from '../../src/bots/application/bots.service'
import { MaintenanceService } from '../../src/bots/application/maintenance.service'
import { AssemblyService } from '../../src/bots/application/assembly.service'
import { FactorySettler } from '../../src/crafting/application/factory-settler'
import { RecipeService } from '../../src/crafting/application/recipe.service'
import { FactoryService } from '../../src/bots/application/factory.service'
import { RecipeBook } from '../../src/crafting/domain/recipe-book'
import { DEFAULT_CRAFTING_CONFIG } from '../../src/crafting/domain/crafting-config'
import { EnergyService } from '../../src/modules/application/energy.service'
import { EnergyModel } from '../../src/modules/domain/energy-model'
import { ModuleFactory } from '../../src/modules/application/module.factory'
import { createModuleRegistry } from '../../src/modules/domain/module-registry'
import { FilesService } from '../../src/files/application/files.service'
import { BlueprintSpawn, MapGenerator } from '../../src/map/domain/map-generator'
import { MapService } from '../../src/map/application/map.service'
import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../../src/map/domain/world-config'
import { FakeScriptRunner } from './engine'
import { BotAccessService } from '../../src/terminal/application/bot-access.service'
import { SessionLogWriter, SessionSecurityLog } from '../../src/terminal/application/session-log-writer'
import { BotSecurityPolicy, DEFAULT_BOT_SECURITY } from '../../src/terminal/domain/bot-security'
import { createTerminalShell } from '../../src/terminal/application/shell/create-terminal-shell'
import { OpenLinkGate } from '../../src/terminal/application/link-gate'
import { TerminalService } from '../../src/terminal/application/terminal.service'
import { DEFAULT_TERMINAL_RETENTION, TerminalRetention } from '../../src/terminal/domain/terminal-retention'
import { Rng } from '../../src/shared/application/rng'
import {
  FakeClock,
  FakeDelay,
  FakeHasher,
  FakeUnitOfWork,
  FixedRng,
  InMemoryAuthTokenRepository,
  InMemoryBotAccessRepository,
  InMemoryBotRepository,
  InMemoryCredentialRepository,
  InMemoryIdentityRepository,
  InMemorySessionRepository,
  InMemoryFileRepository,
  InMemoryItemRepository,
  InMemoryBlueprintRepository,
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
    security?: Partial<BotSecurityPolicy>
    blueprints?: BlueprintSpawn
  } = {}
) {
  const repositories = {
    users: new InMemoryUserRepository(),
    bots: new InMemoryBotRepository(),
    modules: new InMemoryModuleRepository(),
    files: new InMemoryFileRepository(),
    items: new InMemoryItemRepository(),
    blueprints: new InMemoryBlueprintRepository(),
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

  const recipeBook = new RecipeBook(DEFAULT_CRAFTING_CONFIG.recipes, DEFAULT_CRAFTING_CONFIG.balance)
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
  const scriptRunner = new FakeScriptRunner()
  const retention = { ...DEFAULT_TERMINAL_RETENTION, ...options.retention }
  const botAccess = new InMemoryBotAccessRepository()
  const delay = new FakeDelay()
  const terminalService = new TerminalService(terminalSessions, botsService, ids, clock, retention, new OpenLinkGate())
  const energyService = new EnergyService(repositories.modules, new EnergyModel(moduleRegistry))
  const securityPolicy = { ...DEFAULT_BOT_SECURITY, ...options.security }
  const botAccessService = new BotAccessService(
    botsService,
    repositories.bots,
    repositories.modules,
    repositories.map,
    moduleRegistry,
    energyService,
    new FakeHasher(),
    botAccess,
    new SessionSecurityLog(new SessionLogWriter(terminalSessions, ids, clock, retention)),
    clock,
    securityPolicy
  )
  const factorySettler = new FactorySettler(unitOfWork, moduleRegistry, ids, clock, moduleFactory)
  const factoryService = new FactoryService(
    unitOfWork,
    botsService,
    recipeBook,
    clock,
    new EnergyModel(moduleRegistry),
    factorySettler
  )
  const assemblyService = new AssemblyService(
    botsService,
    repositories.modules,
    repositories.items,
    moduleFactory,
    moduleRegistry,
    factoryService
  )
  const recipeService = new RecipeService(recipeBook, repositories.blueprints, factorySettler)
  const maintenanceService = new MaintenanceService(
    unitOfWork,
    botsService,
    recipeBook,
    moduleRegistry,
    new EnergyModel(moduleRegistry),
    clock,
    rng,
    new BaseLifecycle(moduleRegistry),
    ids
  )

  return {
    repositories,
    terminalSessions,
    unitOfWork,
    clock,
    ids,
    config,
    spawnConfig,
    spawnService,
    mapService: new MapService(
      unitOfWork,
      ids,
      new MapGenerator(rng, config, options.blueprints),
      clock,
      config.chunkSize
    ),
    botsService,
    moduleFactory,
    moduleRegistry,
    energyService,
    recipeBook,
    factoryService,
    factorySettler,
    filesService,
    terminalService,
    assemblyService,
    recipeService,
    maintenanceService,
    terminalShell: createTerminalShell(
      botsService,
      filesService,
      terminalService,
      factoryService,
      assemblyService,
      recipeService,
      maintenanceService,
      scriptRunner,
      botAccessService,
      delay,
      securityPolicy.attemptDelayMs
    ),
    scriptRunner,
    botAccessService,
    botAccess,
    delay,
    securityPolicy
  }
}
