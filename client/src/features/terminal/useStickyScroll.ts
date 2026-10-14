'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'

// How far from the end still counts as "at the bottom", in pixels (fractional scroll positions on zoomed screens)
const BOTTOM_TOLERANCE = 4

// Keeps a scrolling element showing its end while new content is added, but only for a reader who was already at the end just
// before: someone who scrolled up to read is not pulled down, and scrolling to the end again resumes following (design §15.1).
// `change` is whatever grows the content; `follow()` makes the next change scroll down, for an action of the reader's own.
//
// "Just before" is judged when the content changes, from the scroll position the element has at that moment against the height
// the reader last saw (the height at the previous change or scroll event). A scroll event arrives after the position changed,
// so a line added in between must not be taken for content the reader scrolled away from.
export function useStickyScroll<T extends HTMLElement>(change: unknown) {
  const ref = useRef<T>(null)
  // 0: nothing has been seen yet, so the first content is followed
  const seenHeight = useRef(0)
  const isForced = useRef(false)

  const onScroll = useCallback(() => {
    const element = ref.current

    if (element) {
      seenHeight.current = element.scrollHeight
    }
  }, [])

  const follow = useCallback(() => {
    isForced.current = true
  }, [])

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const wasAtBottom =
      seenHeight.current === 0 || seenHeight.current - element.scrollTop - element.clientHeight <= BOTTOM_TOLERANCE

    if (isForced.current || wasAtBottom) {
      element.scrollTop = element.scrollHeight
    }
    isForced.current = false
    seenHeight.current = element.scrollHeight || seenHeight.current
  }, [change])

  return { ref, onScroll, follow }
}
