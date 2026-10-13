import type { GameEvent } from '../../engine/domain/game-event'
import type { Candidate } from './notification'

const note = (
  category: Candidate['category'],
  kind: string,
  botId: string | null,
  params: Candidate['params'] = {},
  rest: Partial<Candidate> = {}
): Candidate => ({ category, kind, params, botId, isCoalesced: false, ...rest })

// Which notifications a game event is worth to a player (design §24.2). The first party of an event is the one whose entity it is;
// a player hears of what concerns their own bots, so most rules need the player to be that party. Events no rule is about are
// only animations, achievements or nothing.
export function candidatesOf(userId: string, event: GameEvent): Candidate[] {
  const [first] = event.parties
  const isOwn = first.userId === userId
  const botId = first.botId

  switch (event.type) {
    case 'ShotHit': {
      const victim = event.parties.find((party, index) => index > 0 && party.userId === userId)

      return victim ? [note('attacks', 'underAttack', victim.botId, { hits: event.hits }, { isCoalesced: true })] : []
    }
    case 'ModuleBroken':
      return isOwn ? [note('damage', 'moduleBroken', botId)] : []
    case 'EnergyLow':
      return isOwn ? [note('damage', 'energyLow', botId, {}, { isCoalesced: true })] : []
    case 'OutOfFuel':
      return isOwn ? [note('damage', 'outOfFuel', botId)] : []
    case 'LiveScanStopped':
      return isOwn ? [note('damage', 'liveScanStopped', botId)] : []
    case 'LinkLost':
      return isOwn ? [note('damage', 'linkLost', botId, {}, { isCoalesced: true })] : []
    case 'LinkRestored':
      return isOwn ? [note('damage', 'linkRestored', botId)] : []
    case 'LinkWeak':
      return isOwn ? [note('damage', 'linkWeak', botId, { bars: event.bars }, { isCoalesced: true })] : []
    case 'ExecutionFinished':
      return isOwn ? [note('scripts', 'scriptFinished', botId, {}, { isCoalesced: true })] : []
    case 'ExecutionFailed':
      return isOwn ? [note('scripts', 'scriptFailed', botId, { reason: event.reason }, { isCoalesced: true })] : []
    case 'PasswordAttemptFailed':
      return isOwn
        ? [note('security', 'passwordFailed', botId, { lockedOut: event.isLockedOut }, { isCoalesced: true })]
        : []
    case 'BotAssembled':
      return isOwn ? [note('fabrication', 'botAssembled', event.newBotId)] : []
    case 'CraftOrdered':
      return isOwn
        ? [
            note(
              'fabrication',
              'craftDone',
              botId,
              { module: event.module, count: event.count },
              { dueAt: event.readyAt }
            )
          ]
        : []
    case 'ResearchOrdered':
      return isOwn
        ? [note('fabrication', 'researchDone', botId, { module: event.module }, { dueAt: event.readyAt })]
        : []
    default:
      return []
  }
}
