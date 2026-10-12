import { TutorialStatus, TutorialStep } from '../../../../lib/utils/interfaces/tutorial'

export const TUTORIAL_PROGRESS_REPOSITORY = Symbol('TutorialProgressRepository')
export const TUTORIAL_FACTS = Symbol('TutorialFacts')

// How far a player is in the tutorial, kept in their profile (design §16.1)
export interface TutorialProgress {
  status: TutorialStatus
  done: TutorialStep[]
}

export interface TutorialProgressRepository {
  // A player who never touched the tutorial has it active with nothing done
  get(userId: string): Promise<TutorialProgress>
  save(userId: string, progress: TutorialProgress): Promise<void>
}

// What the player has really done in the game, whatever the tutorial knows of it
export interface TutorialFacts {
  check(userId: string): Promise<Record<TutorialStep, boolean>>
}
