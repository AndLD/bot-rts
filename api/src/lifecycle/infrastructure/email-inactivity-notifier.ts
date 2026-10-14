import { EmailSender } from '../../notifications/application/email-sender'
import { InactivityNotifier } from '../application/inactivity-notifier'

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export class EmailInactivityNotifier implements InactivityNotifier {
  constructor(
    private readonly sender: EmailSender | undefined,
    private readonly frontendUrl: string
  ) {}

  // Without a configured sender nothing is sent (development)
  async sendNotice(to: string, name: string, eraseOn: Date): Promise<void> {
    const date = eraseOn.toISOString().slice(0, 10)
    const html =
      `Hello ${escape(name)}, you have not played for a long time. ` +
      `If you do nothing, your account will be erased on <b>${date}</b>: your name, email and login are removed. ` +
      `To keep it, <a href="${this.frontendUrl}/login">sign in</a> before then.`

    await this.sender?.send({ to, subject: 'Your account will be erased for inactivity', html })
  }
}
