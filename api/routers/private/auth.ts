import { Router } from 'express'

export const authPrivateRouter = Router()
  // Verify JWT token
  .get('/verify', (_req, res) => {
    res.sendStatus(200)
  })
