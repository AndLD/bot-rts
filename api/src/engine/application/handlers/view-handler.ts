import { ok } from '../../../../../lib/utils/result'
import { ScannerModule } from '../../../modules/domain/scanner-module'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { toJson } from '../json'
import { LiveVision } from '../live-vision'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World, WorldBot } from '../world/world'

// view(since?): the live view of a scanner in live mode (design §4.4, §10.2) — all its cells, or the ones that changed after
// a tick. It costs a script operation and no energy.
export class ViewHandler implements ScriptFunctionHandler {
  readonly functions = ['view']

  constructor(
    private readonly world: World,
    private readonly vision: LiveVision
  ) {}

  async handle({ bot }: BotState, _fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    // The calling bot is in memory: the engine has just served its script
    const acting = (await this.world.bot(bot.id)) as WorldBot
    const scanners = this.world
      .modulesOf(acting)
      .filter((module): module is ScannerModule => module instanceof ScannerModule)
    const scanner = scanners.find((candidate) => candidate.isLive) ?? scanners[0]
    const viewable = scanner.view()
    if (!viewable.ok) {
      return viewable
    }
    const since = args[0] as number | null | undefined
    return ok(toJson(await this.vision.view(scanner.id, since ?? undefined)))
  }
}
