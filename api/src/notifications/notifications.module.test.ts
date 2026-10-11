import { mkdtempSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LoggingEmailSender } from './infrastructure/logging-email-sender'
import { OutboxEmailSender } from './infrastructure/outbox-email-sender'
import { SmtpEmailSender } from './infrastructure/smtp-email-sender'
import { createEmailSender, NotificationsModule } from './notifications.module'

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

describe('createEmailSender', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const smtp = { host: 'smtp.example.com', port: 465, secure: true, user: 'u', pass: 'p' }

  it('prefers SMTP whenever it is configured', () => {
    expect(createEmailSender({ smtp, nodeEnv: 'production', emailOutboxDir: undefined }, logger)).toBeInstanceOf(
      SmtpEmailSender
    )
    expect(createEmailSender({ smtp, nodeEnv: 'development', emailOutboxDir: undefined }, logger)).toBeInstanceOf(
      SmtpEmailSender
    )
  })

  it('logs the messages in development without SMTP', () => {
    expect(
      createEmailSender({ smtp: undefined, nodeEnv: 'development', emailOutboxDir: undefined }, logger)
    ).toBeInstanceOf(LoggingEmailSender)
  })

  it('sends nothing elsewhere without SMTP', () => {
    expect(createEmailSender({ smtp: undefined, nodeEnv: 'test', emailOutboxDir: undefined }, logger)).toBeUndefined()
    expect(
      createEmailSender({ smtp: undefined, nodeEnv: 'production', emailOutboxDir: undefined }, logger)
    ).toBeUndefined()
  })

  it('collects the messages in the outbox directory when one is configured, ahead of SMTP', () => {
    const emailOutboxDir = join(mkdtempSync(join(tmpdir(), 'outbox-')), 'mail')

    const sender = createEmailSender({ smtp, nodeEnv: 'production', emailOutboxDir }, logger)

    expect(sender).toBeInstanceOf(OutboxEmailSender)
    expect(existsSync(emailOutboxDir)).toBe(true)
  })
})
