import { EmailMessage, EmailSender } from '../application/email-sender'
import { MeteredEmailSender } from './metered-email-sender'
import { meter } from '../notifications.module'

const message: EmailMessage = { to: 'a@b.c', subject: 's', html: 'h' }

describe('MeteredEmailSender', () => {
  it('sends through the sender it wraps, and counts nothing when it works', async () => {
    const inner: EmailSender = { send: jest.fn(async () => undefined), close: jest.fn() }
    const activity = { emailFailed: jest.fn() }
    const sender = new MeteredEmailSender(inner, activity)

    await sender.send(message)
    sender.close()

    expect(inner.send).toHaveBeenCalledWith(message)
    expect(inner.close).toHaveBeenCalled()
    expect(activity.emailFailed).not.toHaveBeenCalled()
  })

  it('counts an email the mail server refused, and lets the caller see the failure', async () => {
    const inner: EmailSender = { send: jest.fn().mockRejectedValue(new Error('550')), close: jest.fn() }
    const activity = { emailFailed: jest.fn() }

    await expect(new MeteredEmailSender(inner, activity).send(message)).rejects.toThrow('550')

    expect(activity.emailFailed).toHaveBeenCalledTimes(1)
  })

  it('wraps a sender and leaves a missing one missing', () => {
    const activity = { emailFailed: jest.fn() } as never
    const inner: EmailSender = { send: jest.fn(), close: jest.fn() }

    expect(meter(inner, activity)).toBeInstanceOf(MeteredEmailSender)
    expect(meter(undefined, activity)).toBeUndefined()
  })
})
