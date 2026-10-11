import { join } from 'path'
import { EmailMessage, EmailSender } from '../application/email-sender'

export type WriteFile = (path: string, content: string) => Promise<void>

// End-to-end test stand-in for SMTP: each message becomes a JSON file in a directory that a test can read, so it can
// follow the links of the emails the application sends
export class OutboxEmailSender implements EmailSender {
  private sequence = 0

  constructor(
    private readonly directory: string,
    private readonly writeFile: WriteFile,
    private readonly now: () => Date
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const sentAt = this.now().toISOString()
    // The sequence keeps the files of one run in sending order even within the same millisecond
    const name = `${sentAt.replace(/[:.]/g, '-')}-${String(this.sequence++).padStart(6, '0')}.json`

    await this.writeFile(join(this.directory, name), JSON.stringify({ ...message, sentAt }))
  }

  close(): void {
    // Nothing to release
  }
}
