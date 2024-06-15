import { Response } from 'express'
import { Error } from './types'

function sendError(res: Response, error: Error) {
    res.status(error.code || 500).json({
        error: error.msg
    })
    return
}

function sendResult(res: Response, result: any) {
    res.json({
        result
    })
    return
}

export const apiUtils = {
    sendError,
    sendResult
}
