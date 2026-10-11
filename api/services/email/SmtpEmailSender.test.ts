import nodemailer from 'nodemailer'
import { SmtpEmailSender } from './SmtpEmailSender'

jest.mock('nodemailer')

describe('SmtpEmailSender', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined)
  const close = jest.fn()
  const config = { host: 'smtp.example.com', port: 587, secure: false, user: 'user', pass: 'pass' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close })
  })

  it('creates the transport from the config', () => {
    new SmtpEmailSender(config)

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' }
    })
  })

  it('sends a message from the configured user', async () => {
    await new SmtpEmailSender(config).send({ to: 'a@b.c', subject: 'Hi', html: '<b>x</b>' })

    expect(sendMail).toHaveBeenCalledWith({ from: 'Bot RTS <user>', to: 'a@b.c', subject: 'Hi', html: '<b>x</b>' })
  })

  it('closes the transport', () => {
    new SmtpEmailSender(config).close()

    expect(close).toHaveBeenCalled()
  })
})
