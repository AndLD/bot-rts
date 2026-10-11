import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { emptyApi } from '../api/empty-api'
import { sessionSlice } from './session.slice'

const rootReducer = combineReducers({
  session: sessionSlice.reducer,
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
