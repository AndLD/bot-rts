import { useEffect, useState } from 'react'
import { appSlice } from '../store/app.reducer'
import { useVerifyTokenQuery } from '../store/auth.api.ts'
import { isJwtExpired } from '../utils/jwt'
import { useAppDispatch, useAppSelector } from './store'
import { useRefreshToken } from './store/auth.api'
import { API_URL } from '../utils/constants.ts'
import { io } from 'socket.io-client'

export function useAuth() {
    const dispatch = useAppDispatch()
    const token = useToken()
    const [isVerifyTokenSkip, setIsVerifyTokenSkip] = useState<boolean>(true)

    const verifyTokenQuery = useVerifyTokenQuery(undefined, {
        skip: isVerifyTokenSkip
    })
    const refreshToken = useRefreshToken()

    useEffect(() => {
        if (token) {
            if (isJwtExpired(token)) {
                refreshToken()
            } else {
                dispatch(appSlice.actions.setToken(token))
                setIsVerifyTokenSkip(false)
            }
        }
    }, [])

    useEffect(() => {
        if (verifyTokenQuery.isLoading) {
            setIsVerifyTokenSkip(true)
        }
    }, [verifyTokenQuery.isLoading])
}

export function useToken() {
    return useAppSelector((state) => state.appReducer.token)
}

export function useSocketServer() {
    const dispatch = useAppDispatch()

    async function connectSocketServer() {
        const socket = io(API_URL, {
            withCredentials: true,
            reconnectionDelay: 1000
        })

        dispatch(appSlice.actions.setSocket(socket))
    }

    useEffect(() => {
        connectSocketServer()
    }, [])
}
