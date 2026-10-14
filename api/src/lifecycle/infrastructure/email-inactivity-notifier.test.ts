import { EmailInactivityNotifier } from './email-inactivity-notifier'

describe('EmailInactivityNotifier', () => {
  it('tells the player the date and where to sign in, escaping the name', async () => {
    const send = jest.fn(async () => undefined)
    const notifier = new EmailInactivityNotifier({ send, close: jest.fn() }, 'https://play.example')

    await notifier.sendNotice('a@example.com', '<b>Al</b>', new Date('2026-12-01T10:00:00Z'))

    const message = (send.mock.calls[0] as unknown as [{ to: string; subject: string; html: string }])[0]
    expect(message.to).toBe('a@example.com')
    expect(message.subject).toContain('erased')
    expect(message.html).toContain('2026-12-01')
    expect(message.html).toContain('https://play.example/login')
    expect(message.html).not.toContain('<b>Al</b>')
  })

  it('sends nothing without a configured sender', async () => {
    await expect(
      new EmailInactivityNotifier(undefined, 'x').sendNotice('a@b.c', 'A', new Date())
    ).resolves.toBeUndefined()
  })
})
