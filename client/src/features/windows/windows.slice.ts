import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// The windows of the game screen: terminals, the editor and the panels (design §15). Their places are remembered between
// visits, per window id.
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type WindowKind =
  'terminal' | 'storage' | 'factory' | 'control' | 'settings' | 'editor' | 'achievements' | 'notifications' | 'help'

export interface GameWindow extends Rect {
  id: string
  kind: WindowKind
  // What the window is about (for example the bot of a terminal)
  params: Record<string, string>
  // Higher is nearer to the player; the focused window has the highest
  z: number
}

interface WindowsState {
  windows: GameWindow[]
  nextZ: number
  layouts: Record<string, Rect>
}

export const LAYOUT_KEY = 'windows-layout'
// The version of the saved layouts; raised when a default size changes so that places saved with the old one are adjusted once
export const LAYOUT_VERSION_KEY = 'windows-layout-version'
const LAYOUT_VERSION = '2'
export const MIN_WIDTH = 260
export const MIN_HEIGHT = 140
const CASCADE_STEP = 28

export const DEFAULT_SIZES: Record<WindowKind, { width: number; height: number }> = {
  terminal: { width: 640, height: 420 },
  storage: { width: 360, height: 420 },
  factory: { width: 480, height: 520 },
  control: { width: 640, height: 520 },
  settings: { width: 420, height: 440 },
  editor: { width: 640, height: 480 },
  achievements: { width: 420, height: 520 },
  notifications: { width: 420, height: 480 },
  help: { width: 820, height: 560 }
}

function readLayouts(): Record<string, Rect> {
  try {
    const layouts: Record<string, Rect> = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}')

    return localStorage.getItem(LAYOUT_VERSION_KEY) === LAYOUT_VERSION ? layouts : migrateLayouts(layouts)
  } catch {
    return {}
  }
}

// The control window got wider (its inputs did not fit): the one saved narrower than the new default is widened, once.
// What the player does with the width afterwards is kept.
function migrateLayouts(layouts: Record<string, Rect>): Record<string, Rect> {
  const migrated = Object.fromEntries(
    Object.entries(layouts).map(([id, rect]) => [
      id,
      id.startsWith('control:') ? { ...rect, width: Math.max(rect.width, DEFAULT_SIZES.control.width) } : rect
    ])
  )
  storeLayouts(migrated)

  return migrated
}

function storeLayouts(layouts: Record<string, Rect>) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts))
    localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION)
  } catch {
    // The places are then forgotten when the page closes
  }
}

export interface OpenWindow {
  id: string
  kind: WindowKind
  params?: Record<string, string>
}

const byId = (state: WindowsState, id: string) => state.windows.find((window) => window.id === id)

function raise(state: WindowsState, window: GameWindow) {
  window.z = state.nextZ
  state.nextZ += 1
}

export const windowsSlice = createSlice({
  name: 'windows',
  initialState: (): WindowsState => ({ windows: [], nextZ: 1, layouts: readLayouts() }),
  reducers: {
    // Opens a window where it was last, or cascaded from the others; one that is already open just comes to the front
    openWindow(state, action: PayloadAction<OpenWindow>) {
      const { id, kind, params = {} } = action.payload
      const existing = byId(state, id)

      if (existing) {
        raise(state, existing)
        return
      }

      const offset = state.windows.length * CASCADE_STEP
      const rect = state.layouts[id] ?? { x: 24 + offset, y: 56 + offset, ...DEFAULT_SIZES[kind] }
      const window: GameWindow = { id, kind, params, ...rect, z: 0 }
      raise(state, window)
      state.windows.push(window)
    },
    closeWindow(state, action: PayloadAction<string>) {
      state.windows = state.windows.filter((window) => window.id !== action.payload)
    },
    focusWindow(state, action: PayloadAction<string>) {
      const window = byId(state, action.payload)

      if (window && window.z !== state.nextZ - 1) {
        raise(state, window)
      }
    },
    // Moves or resizes a window and remembers where it is
    placeWindow(state, action: PayloadAction<{ id: string } & Partial<Rect>>) {
      const { id, ...change } = action.payload
      const window = byId(state, id)

      if (!window) {
        return
      }
      Object.assign(window, change)
      window.width = Math.max(MIN_WIDTH, window.width)
      window.height = Math.max(MIN_HEIGHT, window.height)
      state.layouts[id] = { x: window.x, y: window.y, width: window.width, height: window.height }
      storeLayouts(state.layouts)
    }
  }
})

export const { openWindow, closeWindow, focusWindow, placeWindow } = windowsSlice.actions
