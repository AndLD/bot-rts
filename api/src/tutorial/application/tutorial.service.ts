import { ITutorial, TUTORIAL_STEPS, TutorialStep } from '../../../../lib/utils/interfaces/tutorial'
import { TutorialFacts, TutorialProgress, TutorialProgressRepository } from './tutorial.ports'

// The guided checklist (design §16.1): a step is done when the player has really done what it asks, and stays done. The
// tutorial can be skipped at any time and started again. There are no rewards and no special rules.
export class TutorialService {
  constructor(
    private readonly progress: TutorialProgressRepository,
    private readonly facts: TutorialFacts
  ) {}

  async get(userId: string): Promise<ITutorial> {
    let current = await this.progress.get(userId)

    if (current.status === 'active') {
      const facts = await this.facts.check(userId)
      const done = TUTORIAL_STEPS.filter((step) => current.done.includes(step) || facts[step])
      const status = done.length === TUTORIAL_STEPS.length ? 'completed' : 'active'

      if (status !== current.status || done.length !== current.done.length) {
        current = { status, done }
        await this.progress.save(userId, current)
      }
    }

    return this.view(current)
  }

  async skip(userId: string): Promise<ITutorial> {
    const current = await this.progress.get(userId)
    await this.progress.save(userId, { ...current, status: 'skipped' })

    return this.view({ ...current, status: 'skipped' })
  }

  // Starts over from the profile settings; what the player has already done is noticed again at once
  async restart(userId: string): Promise<ITutorial> {
    await this.progress.save(userId, { status: 'active', done: [] })

    return this.get(userId)
  }

  private view({ status, done }: TutorialProgress): ITutorial {
    const steps = TUTORIAL_STEPS.map((id) => ({ id, isDone: done.includes(id) }))
    const next: TutorialStep | undefined = steps.find((step) => !step.isDone)?.id

    return { status, steps, current: status === 'active' ? (next ?? null) : null }
  }
}
