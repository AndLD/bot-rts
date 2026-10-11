import { Module, OnApplicationShutdown, Inject } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { EMAIL_SENDER, EmailSender } from './application/email-sender'
import { SmtpEmailSender } from './infrastructure/smtp-email-sender'

// Without SMTP settings no mail is sent (development)
export function createEmailSender(config: Pick<AppConfig, 'smtp'>): EmailSender | undefined {
  return config.smtp ? new SmtpEmailSender(config.smtp) : undefined
}

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG],
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
