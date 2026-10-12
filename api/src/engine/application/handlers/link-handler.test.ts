import { BotState } from '../../domain/bot-state'
import { buildBase } from '../../../../tests/integration/builders'
import { LinkHandler } from './link-handler'

describe('LinkHandler', () => {
  it('tells the script the link status of its bot', async () => {
    const status = { isConnected: false, signal: 0 as const, hops: 0, lostSince: 123 }
    const radio = { statusOf: jest.fn(async () => status) }
    const bot = buildBase('owner-1')
    const state: BotState = { bot, ownerId: 'owner-1', modules: [] }

    const result = await new LinkHandler(radio as never).handle(state)

    expect(result).toEqual({ ok: true, data: status })
    expect(radio.statusOf).toHaveBeenCalledWith('owner-1', bot.id)
  })
})
