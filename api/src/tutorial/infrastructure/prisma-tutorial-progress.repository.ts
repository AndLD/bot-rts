import { PrismaClient } from '@prisma/client'
import { TUTORIAL_STEPS, TutorialStatus, TutorialStep } from '../../../../lib/utils/interfaces/tutorial'
import { TutorialProgress, TutorialProgressRepository } from '../application/tutorial.ports'

const STATUSES: readonly TutorialStatus[] = ['active', 'skipped', 'completed']

export class PrismaTutorialProgressRepository implements TutorialProgressRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(userId: string): Promise<TutorialProgress> {
    const row = await this.db.userSetting.findUnique({ where: { userId }, select: { tutorial: true } })
    const stored = (row?.tutorial ?? {}) as { status?: TutorialStatus; done?: TutorialStep[] }

    return {
      status: STATUSES.includes(stored.status as TutorialStatus) ? (stored.status as TutorialStatus) : 'active',
      done: TUTORIAL_STEPS.filter((step) => stored.done?.includes(step))
    }
  }

  async save(userId: string, progress: TutorialProgress): Promise<void> {
    const data = { tutorial: { status: progress.status, done: progress.done }, updatedAt: this.now() }

    await this.db.userSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  }
}
