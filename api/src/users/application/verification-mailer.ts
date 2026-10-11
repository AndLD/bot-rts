import { EmailSender } from '../../notifications/application/email-sender'
import { User } from '../domain/user.entity'

// Sends the "confirm your email" message; without a configured sender it does nothing (development)
export class VerificationMailer {
  constructor(
    private readonly sender: EmailSender | undefined,
    private readonly frontendUrl: string
  ) {}

  async send(user: User, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verification?token=${encodeURIComponent(token)}`
    const html = `Follow the <a href="${link}">link</a> to confirm your email.<div><b>The link is valid for 24 hours</b></div>`

    await this.sender?.send({ to: user.email, subject: 'Email Verification', html })
  }
}
