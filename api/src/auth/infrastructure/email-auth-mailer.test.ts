import { EmailSender } from '../../notifications/application/email-sender'
import { EmailAuthMailer } from './email-auth-mailer'

describe('EmailAuthMailer', () => {
  const sender = (): jest.Mocked<EmailSender> => ({ send: jest.fn().mockResolvedValue(undefined), close: jest.fn() })

  it.each([
    ['sendEmailVerification', 'verification', 'Confirm your email'],
    ['sendPasswordReset', 'reset-password', 'Reset your password'],
    ['sendEmailChange', 'confirm-email-change', 'Confirm your new email'],
    ['sendAccountDeletion', 'confirm-account-deletion', 'Confirm account deletion']
  ] as const)('%s links to the %s page of the client', async (method, page, subject) => {
    const emailSender = sender()

    await new EmailAuthMailer(emailSender, 'https://game.example')[method]('a@b.c', 'tok en')

    const message = emailSender.send.mock.calls[0][0]
    expect(message).toMatchObject({ to: 'a@b.c', subject })
    expect(message.html).toContain(`https://game.example/${page}?token=tok%20en`)
  })

  it('does nothing when no sender is configured', async () => {
    await expect(
      new EmailAuthMailer(undefined, 'https://game.example').sendPasswordReset('a@b.c', 't')
    ).resolves.toBeUndefined()
  })
})
