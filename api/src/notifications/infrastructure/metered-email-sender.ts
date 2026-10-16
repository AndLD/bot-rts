import { EmailMessage, EmailSender } from '../application/email-sender'

// Sends through another sender and counts the emails it fails to send; the failure still reaches the caller
export class MeteredEmailSender implements EmailSender {
  constructor(
    private readonly inner: EmailSender,
    private readonly activity: { emailFailed(): void }
  ) {}

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.inner.send(message)
    } catch (error) {
      this.activity.emailFailed()
      throw error
    }
  }

  close(): void {
    this.inner.close()
  }
}
