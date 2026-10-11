import { NotificationsModule } from './notifications.module'

describe('NotificationsModule', () => {
  it('closes the sender on shutdown', () => {
    const sender = { send: jest.fn(), close: jest.fn() }

    new NotificationsModule(sender).onApplicationShutdown()

    expect(sender.close).toHaveBeenCalled()
  })

  it('has nothing to close when no sender is configured', () => {
    expect(() => new NotificationsModule(undefined).onApplicationShutdown()).not.toThrow()
  })
})
