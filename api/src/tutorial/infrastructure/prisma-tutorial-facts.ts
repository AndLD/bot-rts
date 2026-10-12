import { PrismaClient } from '@prisma/client'
import { TutorialStep } from '../../../../lib/utils/interfaces/tutorial'
import { TutorialFacts } from '../application/tutorial.ports'

// What the player has done, read from what the game keeps: terminal sessions and their log, the player's knowledge of the map, the
// files on the drives of their bots, the executions, the items and the bots themselves
export class PrismaTutorialFacts implements TutorialFacts {
  constructor(private readonly db: PrismaClient) {}

  async check(userId: string): Promise<Record<TutorialStep, boolean>> {
    const bases = await this.db.bot.findMany({ where: { userId }, select: { id: true } })
    const baseIds = bases.map((base) => base.id)
    const workers = await this.db.bot.findMany({ where: { baseId: { in: baseIds } }, select: { id: true } })
    const botIds = [...baseIds, ...workers.map((worker) => worker.id)]

    const [sessions, listings, known, scripts, executions, parts, factories] = await Promise.all([
      this.db.terminalSession.count({ where: { userId } }),
      this.db.terminalLog.count({ where: { botId: { in: botIds }, kind: 'input', text: 'modules' } }),
      // The base itself is known from the start
      this.db.knownPoint.count({ where: { userId } }),
      this.db.file.count({
        where: {
          kind: 'file',
          drive: { botId: { in: botIds } },
          OR: [{ path: { endsWith: '.js' } }, { path: { endsWith: '.ts' } }]
        }
      }),
      this.db.execution.count({ where: { userId } }),
      this.db.item.count({ where: { botId: { in: botIds }, type: 'part' } }),
      this.db.module.findMany({ where: { botId: { in: botIds }, type: 'factory' }, select: { props: true } })
    ])
    const hasAssembled = workers.length > 0
    const hasQueuedJobs = factories.some(({ props }) => {
      const jobs = (props as { jobs?: unknown } | null)?.jobs
      return Array.isArray(jobs) && jobs.length > 0
    })

    return {
      openTerminal: sessions > 0,
      listModules: listings > 0,
      scan: known > 1,
      writeScript: scripts > 0,
      runScript: executions > 0,
      craft: parts > 0 || hasQueuedJobs || hasAssembled,
      assemble: hasAssembled
    }
  }
}
