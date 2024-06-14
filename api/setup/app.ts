import express from 'express'
import cors, { CorsOptions } from 'cors'
import helmet from 'helmet'
import { loggerMiddleware } from '../middlewares/logger'

export function setupApp() {
    const app = express()

    app.use(helmet())
    app.use(express.json())

    const whitelist = process.env.WHITELIST_URLS
    const corsOptions: CorsOptions = {
        origin: function (
            origin: string | undefined,
            callback: (err: Error | null, origin?: boolean) => void
        ) {
            if (!origin || whitelist?.indexOf(origin) !== -1) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        credentials: true
    }
    app.use(cors(corsOptions))
    app.use(loggerMiddleware)

    return app
}
