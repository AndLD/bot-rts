import { combineReducers, configureStore } from '@reduxjs/toolkit'
import appReducer from './app.reducer.ts'
import { authApi } from './auth.api.ts'
import { privateUsersApi, publicUsersApi } from './users.api.ts'

const rootReducer = combineReducers({
    appReducer,
    [authApi.reducerPath]: authApi.reducer,
    [privateUsersApi.reducerPath]: privateUsersApi.reducer,
    [publicUsersApi.reducerPath]: publicUsersApi.reducer
})

export const setupStore = () => {
    return configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) => {
            return getDefaultMiddleware({
                serializableCheck: false
            }).concat(authApi.middleware, privateUsersApi.middleware, publicUsersApi.middleware)
        }
    })
}

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']
