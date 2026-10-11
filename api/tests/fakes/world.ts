import { BotsService } from '../../src/bots/application/bots.service'
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
  InMemoryTerminalSessionRepository,
  InMemoryUserRepository,
  SequentialIdGenerator
} from './fakes'

// Everything a use-case test needs, wired with fakes
export function createWorld(
  options: { rng?: Rng; config?: Partial<WorldConfig>; retention?: Partial<TerminalRetention> } = {}
) {
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

  const terminalSessions = new InMemoryTerminalSessionRepository()
  const botsService = new BotsService(unitOfWork, repositories.bots, repositories.modules, ids, rng, clock, config)
  const filesService = new FilesService(unitOfWork, botsService, repositories.files, ids)
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
    mapService: new MapService(unitOfWork, ids, new MapGenerator(rng, config), clock, config.chunkSize),
    botsService,
    filesService,
    terminalService,
    terminalShell: createTerminalShell(botsService, filesService, terminalService)
  }
}
