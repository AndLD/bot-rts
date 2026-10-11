export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
  close(): void
}

export const EMAIL_SENDER = Symbol('EmailSender')
