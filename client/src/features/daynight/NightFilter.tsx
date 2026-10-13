'use client'

import { DayPhase } from '@lib/utils/game-time'
import './DayNight.scss'
import { NIGHT_FILTER_FADE_SECONDS, NIGHT_FILTER_OPACITY } from './nightFilterStyle'

interface Props {
  phase: DayPhase | undefined
  // The fade is replaced by an instant change (design §15.2)
  isReducedMotion: boolean
}

// A dark-blue layer over the map whose strength follows the part of the day. It lets pointer events through, so clicking and
// inspecting cells works at any hour.
export default function NightFilter({ phase, isReducedMotion }: Props) {
  return (
    <div
      className="night-filter"
      data-testid="night-filter"
      aria-hidden="true"
      style={{
        // Also here, so that no stylesheet change can make the filter swallow a click
        pointerEvents: 'none',
        opacity: phase ? NIGHT_FILTER_OPACITY[phase] : 0,
        transition: isReducedMotion ? 'none' : `opacity ${NIGHT_FILTER_FADE_SECONDS}s linear`
      }}
    />
  )
}
