import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Socket } from 'socket.io-client'

interface IState {
    token: string | null
    socket: Socket | null
}

const initialState: IState = {
    token: localStorage.getItem('token'),
    socket: null
}

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setToken(state, action: PayloadAction<string | null>) {
            state.token = action.payload
            if (action.payload) {
                localStorage.setItem('token', action.payload)
            } else {
                localStorage.removeItem('token')
            }
        },
        setSocket(state, action: PayloadAction<Socket | null>) {
            state.socket = action.payload as any
        }
    }
})

export default appSlice.reducer
