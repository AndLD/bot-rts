import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { authApi } from '../../features/auth/auth.api'
import { sessionSlice } from './session.slice'

const rootReducer = combineReducers({
  session: sessionSlice.reducer,
  [authApi.reducerPath]: authApi.reducer
})

export const setupStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware)
  })

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']
