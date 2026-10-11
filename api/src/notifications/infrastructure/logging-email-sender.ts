import { Logger } from '../../shared/application/logger'
import { EmailMessage, EmailSender } from '../application/email-sender'

// Development stand-in for SMTP: the message, with its links, goes to the log instead of the mailbox
export class LoggingEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send({ to, subject, html }: EmailMessage): Promise<void> {
    this.logger.info(`[email to ${to}] ${subject}: ${html}`)
  }

  close(): void {
    // Nothing to release
  }
}
