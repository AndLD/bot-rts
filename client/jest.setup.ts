import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// The Ant Design tests are slow on a busy machine (the whole suite runs in parallel with coverage); a wait that is long enough
// costs nothing when the element is there at once
configure({ asyncUtilTimeout: 5000 })

// Ant Design writes its styles as CSS rules into the document, and jsdom answers every getComputedStyle by matching all of them: with
// the rules of a few components one call takes about 80 ms, and the role queries of Testing Library call it for every element, which
// made the admin page tests take minutes. jsdom does no layout, so the components render here without their style rules (the
// element that updateCSS hands back is only used by Ant Design to tag the rules, and stays out of the document).
jest.mock('rc-util/lib/Dom/dynamicCSS', () => ({
  ...jest.requireActual('rc-util/lib/Dom/dynamicCSS'),
  updateCSS: () => document.createElement('style')
}))

// Ant Design reads these browser APIs, which jsdom does not provide
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false
  })
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub
