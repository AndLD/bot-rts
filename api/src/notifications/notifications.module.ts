import { Module, OnApplicationShutdown, Inject } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { EMAIL_SENDER, EmailSender } from './application/email-sender'
import { LOGGER, Logger } from '../shared/application/logger'
import { LoggingEmailSender } from './infrastructure/logging-email-sender'
import { SmtpEmailSender } from './infrastructure/smtp-email-sender'

// SMTP when it is configured; otherwise development logs the messages (the links are in the server log) and any other
// environment sends nothing
export function createEmailSender(
  config: Pick<AppConfig, 'smtp' | 'nodeEnv'>,
  logger: Logger
): EmailSender | undefined {
  if (config.smtp) {
    return new SmtpEmailSender(config.smtp)
  }

  return config.nodeEnv === 'development' ? new LoggingEmailSender(logger) : undefined
}

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG, LOGGER],
      useFactory: createEmailSender
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
