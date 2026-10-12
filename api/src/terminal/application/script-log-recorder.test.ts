import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../tests/fakes/world'
import { ScriptLogRecorder } from './script-log-recorder'
import { ScriptOutput, ScriptOutputFeed } from './script-runner'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

class Feed implements ScriptOutputFeed {
  listener: ((output: ScriptOutput) => void) | null = null
  onOutput(listener: (output: ScriptOutput) => void) {
    this.listener = listener
    return () => {
      this.listener = null
    }
  }
}

async function setup() {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice, { password: 'secret1' })
  const feed = new Feed()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const recorder = new ScriptLogRecorder(feed, world.terminalService, logger)
  recorder.start()
  const say = (kind: ScriptOutput['kind'], text: string) =>
    feed.listener?.({ userId: alice.id, botId: bot.id, executionId: 'abcdef0123456789', kind, text })
  const history = async () => (await world.terminalService.history(alice.id, bot.id, 50)).map((e) => [e.kind, e.text])
  return { ...world, bot, feed, recorder, say, history, logger }
}

describe('ScriptLogRecorder', () => {
  it('keeps the lines of a script in the log of its bot, in order, tagged with the execution', async () => {
    const { say, recorder, history } = await setup()

    say('output', 'one')
    say('error', 'boom')
    say('system', 'rebooted')
    await recorder.shutdown()

    expect(await history()).toEqual([
      [TERMINAL_LOG_KIND.OUTPUT, '[abcdef01] one'],
      [TERMINAL_LOG_KIND.ERROR, '[abcdef01] boom'],
      [TERMINAL_LOG_KIND.OUTPUT, '[abcdef01] rebooted']
    ])
  })

  it('opens one closed session for a bot that never had a terminal, and then keeps using it', async () => {
    const { say, recorder, terminalSessions } = await setup()

    say('output', 'a')
    say('output', 'b')
    await recorder.shutdown()

    expect(terminalSessions.sessions.size).toBe(1)
    const [session] = [...terminalSessions.sessions.values()]
    expect(session.endedAt).toEqual(session.startedAt)
  })

  it('writes into the open terminal session of the bot', async () => {
    const { say, recorder, terminalService, bot, terminalSessions } = await setup()
    const session = await terminalService.open(alice.id, bot.id)

    say('output', 'a')
    await recorder.shutdown()

    expect(terminalSessions.logs.map((entry) => entry.sessionId)).toEqual([session.id])
  })

  it('stops listening on shutdown, and logs a failure to store a line without stopping', async () => {
    const { say, recorder, feed, terminalService, logger } = await setup()
    jest.spyOn(terminalService, 'recordScriptOutput').mockRejectedValueOnce(new Error('db down'))

    say('output', 'lost')
    say('output', 'kept')
    await recorder.shutdown()

    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(terminalService.recordScriptOutput).toHaveBeenCalledTimes(2)
    expect(feed.listener).toBeNull()
  })
})
