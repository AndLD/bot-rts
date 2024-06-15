import { Router } from 'express'

export default Router()
    // Verify JWT token
    .get('/verify', (_: any, res) => {
        res.sendStatus(200)
    })
