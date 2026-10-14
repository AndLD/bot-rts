import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// The Ant Design tests are slow on a busy machine (the whole suite runs in parallel with coverage); a wait that is long enough
// costs nothing when the element is there at once
configure({ asyncUtilTimeout: 5000 })

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
