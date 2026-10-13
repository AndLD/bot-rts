import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// The page the Help window of the game should show (design §15.5). Every request has its own number, so asking again for the page
// that was asked for before, after the player has moved on inside the window, shows it again.
interface HelpState {
  slug: string
  request: number
}

export const helpSlice = createSlice({
  name: 'help',
  initialState: { slug: '', request: 0 } as HelpState,
  reducers: {
    showHelp(state, action: PayloadAction<string>) {
      state.slug = action.payload
      state.request += 1
    }
  }
})

export const { showHelp } = helpSlice.actions
