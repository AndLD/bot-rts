import express from 'express'
import request from 'supertest'
import { AppError } from '../src/shared/domain/app-error'
import { NotFoundError } from '../src/shared/domain/errors'
import { asyncHandler } from './async-handler'
import { handleError } from './error-handler'

function appThrowing(error: unknown) {
  const app = express()
  app.use(express.json())
  app.post('/sync', () => {
    throw error
  })
  app.post(
    '/async',
    asyncHandler(async () => Promise.reject(error))
  )
  app.use(handleError)
  return app
}

describe('handleError', () => {
  it('maps an AppError to its status, code and message', async () => {
    const response = await request(appThrowing(new NotFoundError('Bot not found')))
      .post('/sync')
      .expect(404)

    expect(response.body).toEqual({ statusCode: 404, code: 'NOT_FOUND', error: 'Bot not found' })
  })

  it('handles errors of asynchronous handlers the same way', async () => {
    const response = await request(appThrowing(new AppError(418, 'TEAPOT', 'Short and stout')))
      .post('/async')
      .expect(418)

    expect(response.body.code).toBe('TEAPOT')
  })

  it('hides the details of unexpected errors', async () => {
    const response = await request(appThrowing(new Error('db password is hunter2')))
      .post('/async')
      .expect(500)

    expect(response.body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', error: 'Internal server error' })
  })

  it('treats a thrown null as an unexpected error', async () => {
    await request(appThrowing(null)).post('/async').expect(500)
  })

  it('reports malformed JSON as a client error', async () => {
    const response = await request(appThrowing(new Error('unused')))
      .post('/sync')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400)

    expect(response.body.code).toBe('VALIDATION_FAILED')
  })
})
