import { BotsService } from '../../src/bots/application/bots.service'
import { ScanService } from '../../src/bots/application/scan.service'
import { AppServices } from '../../src/legacy/legacy-services'
import { EmailSender } from '../../src/notifications/application/email-sender'
import { UsersService } from '../../src/users/application/users.service'
import { VerificationMailer } from '../../src/users/application/verification-mailer'
import { FakeHasher } from './fakes'
import { createWorld } from './world'

// All application services wired with fakes, in the shape the Express layer expects
export function createFakeServices(options: Parameters<typeof createWorld>[0] = {}) {
  const world = createWorld(options)
  const sender: jest.Mocked<EmailSender> = { send: jest.fn().mockResolvedValue(undefined), close: jest.fn() }
  const users = new UsersService(world.repositories.users, new FakeHasher(), world.ids, world.clock)
  const bots: BotsService = world.botsService
  const services: AppServices = {
    users,
    bots,
    scan: new ScanService(bots, world.repositories.modules, world.repositories.map, world.mapService),
    mapService: world.mapService,
    verificationMailer: new VerificationMailer(sender, 'https://game.example')
  }

  return { ...world, services, sender }
}
