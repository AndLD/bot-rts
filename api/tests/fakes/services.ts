import { ScanService } from '../../src/bots/application/scan.service'
import { AppServices } from '../../src/legacy/legacy-services'
import { UsersService } from '../../src/users/application/users.service'
import { createAuthWorld } from './auth'

// All application services wired with fakes
export function createFakeServices(options: Parameters<typeof createAuthWorld>[0] = {}) {
  const world = createAuthWorld(options)
  const users = new UsersService(world.repositories.users, world.clock)
  const services: AppServices = {
    auth: world.authService,
    bots: world.botsService,
    scan: new ScanService(world.botsService, world.repositories.modules, world.repositories.map, world.mapService)
  }

  return { ...world, users, services }
}
