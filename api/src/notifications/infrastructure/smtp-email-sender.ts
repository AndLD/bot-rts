import nodemailer from 'nodemailer'
import { EmailMessage, EmailSender } from '../application/email-sender'
import { SmtpConfig } from './smtp-config'

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    })
  }

  async send({ to, subject, html }: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: `Bot RTS <${this.config.user}>`, to, subject, html })
  }

  close(): void {
    this.transporter.close()
  }
}
