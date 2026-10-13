import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { emptyApi } from '../api/empty-api'
import { windowsSlice } from '../../features/windows/windows.slice'
import { helpSlice } from '../../docs/help.slice'
import { sessionSlice } from './session.slice'

const rootReducer = combineReducers({
  session: sessionSlice.reducer,
  windows: windowsSlice.reducer,
  help: helpSlice.reducer,
  [emptyApi.reducerPath]: emptyApi.reducer
})

export const setupStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(emptyApi.middleware)
  })

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']
