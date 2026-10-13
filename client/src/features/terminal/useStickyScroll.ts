'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'

// How far from the end still counts as "at the bottom", in pixels (fractional scroll positions on zoomed screens)
const BOTTOM_TOLERANCE = 4

// Keeps a scrolling element showing its end while new content is added, but only for a reader who was already at the end just
// before: someone who scrolled up to read is not pulled down, and scrolling to the end again resumes following (design §15.1).
// `change` is whatever grows the content; `follow()` makes the next change scroll down, for an action of the reader's own.
export function useStickyScroll<T extends HTMLElement>(change: unknown) {
  const ref = useRef<T>(null)
  const isFollowing = useRef(true)

  const onScroll = useCallback(() => {
    const element = ref.current

    if (element) {
      isFollowing.current = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_TOLERANCE
    }
  }, [])

  const follow = useCallback(() => {
    isFollowing.current = true
  }, [])

  // The position is read from what the last scroll left, not from the element now: the new content is already in it
  useLayoutEffect(() => {
    const element = ref.current

    if (element && isFollowing.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [change])

  return { ref, onScroll, follow }
}
