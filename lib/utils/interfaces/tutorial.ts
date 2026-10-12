// The guided checklist after the first base is deployed (design §16.1). Each step is done by really doing it in the game.
export const TUTORIAL_STEPS = [
  'openTerminal',
  'listModules',
  'scan',
  'writeScript',
  'runScript',
  'craft',
  'assemble'
] as const

export type TutorialStep = (typeof TUTORIAL_STEPS)[number]

export type TutorialStatus = 'active' | 'skipped' | 'completed'

export interface ITutorialStep {
  id: TutorialStep
  isDone: boolean
}

export interface ITutorial {
  status: TutorialStatus
  steps: ITutorialStep[]
  // The first step that is not done, while the tutorial is active
  current: TutorialStep | null
}
