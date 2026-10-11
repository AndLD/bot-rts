import { EmailSender } from '../../notifications/application/email-sender'
import { AuthMailer } from '../application/ports'

// Builds the messages of the account flows; the links lead to pages of the web client
export class EmailAuthMailer implements AuthMailer {
  constructor(
    private readonly sender: EmailSender | undefined,
    private readonly frontendUrl: string
  ) {}

  sendEmailVerification(to: string, token: string): Promise<void> {
    return this.send(to, 'Confirm your email', 'verification', token, 'confirm your email', '24 hours')
  }

  sendPasswordReset(to: string, token: string): Promise<void> {
    return this.send(to, 'Reset your password', 'reset-password', token, 'choose a new password', '1 hour')
  }

  sendEmailChange(to: string, token: string): Promise<void> {
    return this.send(to, 'Confirm your new email', 'confirm-email-change', token, 'confirm this address', '24 hours')
  }

  sendAccountDeletion(to: string, token: string): Promise<void> {
    return this.send(
      to,
      'Confirm account deletion',
      'confirm-account-deletion',
      token,
      'delete your account for good',
      '1 hour'
    )
  }

  // Without a configured sender nothing is sent (development)
  private async send(to: string, subject: string, page: string, token: string, action: string, validFor: string) {
    const link = `${this.frontendUrl}/${page}?token=${encodeURIComponent(token)}`
    const html = `Follow the <a href="${link}">link</a> to ${action}.<div><b>The link is valid for ${validFor}</b></div>`

    await this.sender?.send({ to, subject, html })
  }
}
