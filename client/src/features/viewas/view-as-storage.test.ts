import { clearViewAs, openViewAsTab, readViewAs, ViewAsInfo } from './view-as-storage'

const info: ViewAsInfo = { token: 'viewer', expiresAt: 5_000_000, playerName: 'Alice' }

function visit(search: string) {
  window.history.replaceState(null, '', `/game${search}`)
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
  visit('')
})

describe('the view of a tab', () => {
  it('is none in an ordinary tab, even when a handoff waits', () => {
    localStorage.setItem('viewAsHandoff', JSON.stringify({ info, at: Date.now() }))

    expect(readViewAs()).toBeNull()
    expect(localStorage.getItem('viewAsHandoff')).not.toBeNull()
  })

  it('is taken over from the handoff by the tab that was opened for it, once', () => {
    visit('?view-as=1')
    localStorage.setItem('viewAsHandoff', JSON.stringify({ info, at: Date.now() }))

    expect(readViewAs()).toEqual(info)
    expect(localStorage.getItem('viewAsHandoff')).toBeNull()
    expect(JSON.parse(sessionStorage.getItem('viewAs') as string)).toEqual(info)

    visit('')
    expect(readViewAs()).toEqual(info)
  })

  it.each([
    ['is too old', JSON.stringify({ info, at: 0 })],
    ['is malformed', '{'],
    ['has no details', JSON.stringify({ info: { token: 1 }, at: Date.now() })],
    ['is empty', null]
  ])('is ignored when the handoff %s', (_name, handoff) => {
    visit('?view-as=1')
    if (handoff) localStorage.setItem('viewAsHandoff', handoff)

    expect(readViewAs()).toBeNull()
    expect(sessionStorage.getItem('viewAs')).toBeNull()
  })

  it('ends with clearViewAs', () => {
    sessionStorage.setItem('viewAs', JSON.stringify(info))
    expect(readViewAs()).toEqual(info)

    clearViewAs()
    expect(readViewAs()).toBeNull()
  })

  it('survives a storage that cannot be used', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(readViewAs()).toBeNull()
    expect(() => clearViewAs()).not.toThrow()
  })
})

describe('opening the view in a tab', () => {
  it('hands the view over through the local storage and opens the game', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue({} as Window)

    expect(openViewAsTab(info)).toBe(true)
    expect(open).toHaveBeenCalledWith('/game?view-as=1', '_blank')
    expect(JSON.parse(localStorage.getItem('viewAsHandoff') as string).info).toEqual(info)
  })

  it('says so when the browser blocks the tab or the storage', () => {
    jest.spyOn(window, 'open').mockReturnValue(null)
    expect(openViewAsTab(info)).toBe(false)

    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(openViewAsTab(info)).toBe(false)
  })
})
