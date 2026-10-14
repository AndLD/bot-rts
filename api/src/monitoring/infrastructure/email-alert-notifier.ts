import { EmailSender } from '../../notifications/application/email-sender'
import { AlertNotifier } from '../application/ports'
import { Alert } from '../domain/alert'

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Emails a red alert to the configured recipients (design §25.5); with no sender or no recipients it does nothing
export class EmailAlertNotifier implements AlertNotifier {
  constructor(
    private readonly sender: EmailSender | undefined,
    private readonly recipients: readonly string[],
    private readonly consoleUrl: string
  ) {}

  async notify(alert: Alert): Promise<void> {
    if (!this.sender) {
      return
    }
    const subject = `[Bot RTS] ${alert.severity.toUpperCase()}: ${alert.metric}`
    const html = `<p>${escapeHtml(alert.metric)} is ${alert.value} (threshold ${alert.threshold}) since ${alert.openedAt.toISOString()}.</p><p><a href="${escapeHtml(this.consoleUrl)}/admin">Open the console</a></p>`

    await Promise.all(this.recipients.map((to) => this.sender?.send({ to, subject, html })))
  }
}
