import { EmailMessage } from '../../notifications/application/email-sender'
import { Alert } from '../domain/alert'
import { EmailAlertNotifier } from './email-alert-notifier'

const alert: Alert = {
  id: 'a1',
  metric: 'engine.up',
  area: 'engine',
  severity: 'red',
  value: 0,
  threshold: 1,
  openedAt: new Date('2026-06-01T12:00:00.000Z'),
  clearedAt: null,
  acknowledgedAt: null,
  acknowledgedBy: null
}

describe('EmailAlertNotifier', () => {
  it('emails every recipient with the metric, the values and a link to the console', async () => {
    const sent: EmailMessage[] = []
    const sender = { send: async (message: EmailMessage) => void sent.push(message), close: () => undefined }

    await new EmailAlertNotifier(sender, ['a@x.io', 'b@x.io'], 'https://play.example').notify(alert)

    expect(sent.map((message) => message.to)).toEqual(['a@x.io', 'b@x.io'])
    expect(sent[0].subject).toBe('[Bot RTS] RED: engine.up')
    expect(sent[0].html).toContain('engine.up is 0 (threshold 1)')
    expect(sent[0].html).toContain('https://play.example/admin')
  })

  it('does nothing without a mail sender', async () => {
    await expect(new EmailAlertNotifier(undefined, ['a@x.io'], 'https://x').notify(alert)).resolves.toBeUndefined()
  })
})
