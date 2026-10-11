import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { authApi } from '../../features/auth/auth.api'
import { gameApi } from '../../features/game/game.api'
import { sessionSlice } from './session.slice'

const rootReducer = combineReducers({
  session: sessionSlice.reducer,
  [authApi.reducerPath]: authApi.reducer,
  [gameApi.reducerPath]: gameApi.reducer
})

export const setupStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware, gameApi.middleware)
  })

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']
