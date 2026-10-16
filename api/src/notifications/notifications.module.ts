import { mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { Module, OnApplicationShutdown, Inject } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { EMAIL_SENDER, EmailSender } from './application/email-sender'
import { LOGGER, Logger } from '../shared/application/logger'
import { API_ACTIVITY, ApiActivity } from '../shared/application/api-activity'
import { MeteredEmailSender } from './infrastructure/metered-email-sender'
import { LoggingEmailSender } from './infrastructure/logging-email-sender'
import { OutboxEmailSender } from './infrastructure/outbox-email-sender'
import { SmtpEmailSender } from './infrastructure/smtp-email-sender'

// An outbox directory (end-to-end tests) first, then SMTP when it is configured; otherwise development logs the messages
// (the links are in the server log) and any other environment sends nothing
// Counts the emails the mail server refuses, for the console
export function meter(sender: EmailSender | undefined, activity: ApiActivity): EmailSender | undefined {
  return sender && new MeteredEmailSender(sender, activity)
}

export function createEmailSender(
  config: Pick<AppConfig, 'smtp' | 'nodeEnv' | 'emailOutboxDir'>,
  logger: Logger
): EmailSender | undefined {
  if (config.emailOutboxDir) {
    mkdirSync(config.emailOutboxDir, { recursive: true })

    return new OutboxEmailSender(config.emailOutboxDir, writeFile, () => new Date())
  }

  if (config.smtp) {
    return new SmtpEmailSender(config.smtp)
  }

  return config.nodeEnv === 'development' ? new LoggingEmailSender(logger) : undefined
}

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG, LOGGER, API_ACTIVITY],
      useFactory: (config: AppConfig, logger: Logger, activity: ApiActivity) =>
        meter(createEmailSender(config, logger), activity)
    }
  ],
  exports: [EMAIL_SENDER]
})
export class NotificationsModule implements OnApplicationShutdown {
  constructor(@Inject(EMAIL_SENDER) private readonly sender: EmailSender | undefined) {}

  onApplicationShutdown() {
    this.sender?.close()
  }
}
