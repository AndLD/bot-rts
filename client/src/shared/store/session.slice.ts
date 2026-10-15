import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { readViewAs } from '../../features/viewas/view-as-storage'

const TOKEN_KEY = 'token'

interface SessionState {
  // The access token; who the player is comes from the server (`useCurrentUser`)
  token: string | null
}

// A tab that shows a player's game keeps its own token and never writes the admin's
function readStoredToken(): string | null {
  const view = readViewAs()

  if (view) {
    return view.token
  }
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null) {
  if (readViewAs()) {
    return
  }
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // The token then lives only in memory for this page
  }
}

export const sessionSlice = createSlice({
  name: 'session',
  initialState: (): SessionState => ({ token: readStoredToken() }),
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload
      storeToken(action.payload)
    }
  }
})

export const { setToken } = sessionSlice.actions
