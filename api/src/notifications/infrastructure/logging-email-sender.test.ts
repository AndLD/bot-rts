import { Logger } from '../../shared/application/logger'
import { LoggingEmailSender } from './logging-email-sender'

describe('LoggingEmailSender', () => {
  it('writes the message to the log and closes without effect', async () => {
    const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const sender = new LoggingEmailSender(logger)

    await sender.send({ to: 'a@b.c', subject: 'Hi', html: '<a href="https://x/y?token=abc">link</a>' })
    sender.close()

    expect(logger.info).toHaveBeenCalledWith('[email to a@b.c] Hi: <a href="https://x/y?token=abc">link</a>')
  })
})
