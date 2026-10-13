import { TUTORIAL_STEPS, TutorialStep } from '../../../../lib/utils/interfaces/tutorial'
import { TutorialFacts, TutorialProgress, TutorialProgressRepository } from './tutorial.ports'
import { TutorialService } from './tutorial.service'

class InMemoryProgress implements TutorialProgressRepository {
  saved: TutorialProgress[] = []
  current: TutorialProgress = { status: 'active', done: [] }

  async get() {
    return this.current
  }

  async save(_userId: string, progress: TutorialProgress) {
    this.current = progress
    this.saved.push(progress)
  }
}

function setup(done: TutorialStep[] = [], onCompleted?: (userId: string) => void) {
  const progress = new InMemoryProgress()
  const happened = new Set<TutorialStep>(done)
  const facts: TutorialFacts = {
    check: jest.fn(async () => Object.fromEntries(TUTORIAL_STEPS.map((step) => [step, happened.has(step)])) as never)
  }

  return { progress, facts, happened, service: new TutorialService(progress, facts, onCompleted) }
}

describe('TutorialService', () => {
  it('starts active with the first step as the one to do', async () => {
    const { service, progress } = setup()

    const tutorial = await service.get('u')

    expect(tutorial.status).toBe('active')
    expect(tutorial.current).toBe('openTerminal')
    expect(tutorial.steps).toHaveLength(TUTORIAL_STEPS.length)
    expect(tutorial.steps.every((step) => !step.isDone)).toBe(true)
    expect(progress.saved).toEqual([])
  })

  it('marks a step done when the player has really done it, and keeps it done', async () => {
    const { service, happened, progress } = setup(['openTerminal', 'scan'])

    const first = await service.get('u')
    expect(first.steps.filter((step) => step.isDone).map((step) => step.id)).toEqual(['openTerminal', 'scan'])
    expect(first.current).toBe('listModules')
    expect(progress.saved).toEqual([{ status: 'active', done: ['openTerminal', 'scan'] }])

    // The fact is gone (say the script was deleted), the step stays done
    happened.clear()
    expect((await service.get('u')).steps.find((step) => step.id === 'scan')?.isDone).toBe(true)
    expect(progress.saved).toHaveLength(1)
  })

  it('tells once when a player finishes the tutorial', async () => {
    const onCompleted = jest.fn()
    const { service } = setup([...TUTORIAL_STEPS], onCompleted)

    await service.get('u')
    await service.get('u')

    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect(onCompleted).toHaveBeenCalledWith('u')
  })

  it('completes when every step is done, and stops looking after that', async () => {
    const { service, facts, progress } = setup([...TUTORIAL_STEPS])

    const tutorial = await service.get('u')

    expect(tutorial).toMatchObject({ status: 'completed', current: null })
    expect(progress.current.status).toBe('completed')
    ;(facts.check as jest.Mock).mockClear()
    await service.get('u')
    expect(facts.check).not.toHaveBeenCalled()
  })

  it('can be skipped at any time, and then neither looks at the game nor points at a step', async () => {
    const { service, facts, progress } = setup(['openTerminal'])
    await service.get('u')

    const skipped = await service.skip('u')

    expect(skipped).toMatchObject({ status: 'skipped', current: null })
    expect(skipped.steps[0].isDone).toBe(true)
    expect(progress.current).toEqual({ status: 'skipped', done: ['openTerminal'] })
    ;(facts.check as jest.Mock).mockClear()
    expect((await service.get('u')).status).toBe('skipped')
    expect(facts.check).not.toHaveBeenCalled()
  })

  it('starts again from the settings, noticing at once what was already done', async () => {
    const { service, progress } = setup(['openTerminal', 'listModules'])
    await service.skip('u')

    const restarted = await service.restart('u')

    expect(restarted.status).toBe('active')
    expect(restarted.current).toBe('scan')
    expect(progress.current.done).toEqual(['openTerminal', 'listModules'])
  })
})
