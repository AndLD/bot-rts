import { OutboxEmailSender } from './outbox-email-sender'

describe('OutboxEmailSender', () => {
  it('writes each message as a JSON file named by time and order', async () => {
    const writeFile = jest.fn().mockResolvedValue(undefined)
    const sender = new OutboxEmailSender('/outbox', writeFile, () => new Date('2026-01-02T03:04:05.678Z'))

    await sender.send({ to: 'a@b.c', subject: 'Hi', html: '<a>link</a>' })
    await sender.send({ to: 'd@e.f', subject: 'Again', html: '' })
    sender.close()

    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      '/outbox/2026-01-02T03-04-05-678Z-000000.json',
      JSON.stringify({ to: 'a@b.c', subject: 'Hi', html: '<a>link</a>', sentAt: '2026-01-02T03:04:05.678Z' })
    )
    expect(writeFile.mock.calls[1][0]).toBe('/outbox/2026-01-02T03-04-05-678Z-000001.json')
  })
})
