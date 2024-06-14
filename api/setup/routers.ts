import { Express, NextFunction, Request, Response, Router } from 'express'
// import { boardsRouter } from '../routers/boards'
import { ErrorHandler, handleError } from '../middlewares/ErrorHandler'

export function setupRouters(app: Express) {
    const apiRouter = Router()
    app.use('/api', apiRouter)
    // apiRouter.use('/boards', boardsRouter)

    app.use((err: ErrorHandler, req: Request, res: Response, next: NextFunction) =>
        handleError(err, res)
    )
}
