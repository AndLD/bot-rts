import { buildUser } from '../../../tests/integration/builders'
import { EmailSender } from '../../notifications/application/email-sender'
import { VerificationMailer } from './verification-mailer'

describe('VerificationMailer', () => {
  it('sends a message with the verification link', async () => {
    const sender: jest.Mocked<EmailSender> = { send: jest.fn().mockResolvedValue(undefined), close: jest.fn() }

    await new VerificationMailer(sender, 'https://game.example').send(buildUser({ email: 'a@b.c' }), 'tok en')

    const message = sender.send.mock.calls[0][0]
    expect(message.to).toBe('a@b.c')
    expect(message.html).toContain('https://game.example/verification?token=tok%20en')
  })

  it('does nothing when no sender is configured', async () => {
    await expect(
      new VerificationMailer(undefined, 'https://game.example').send(buildUser(), 't')
    ).resolves.toBeUndefined()
  })
})
