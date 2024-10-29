import { Controller } from './types'
import { getLogger } from './logger'

const logger = getLogger('utils/decorators')

// Cover controller with "try catch" checking
export const tryCatch = (controller: Controller) =>
  async function (req: any, res: any, next?: any) {
    try {
      await controller(req, res, next)
    } catch (err) {
      logger.error(`Error [${req.method}, ${req.originalUrl}]${req.isSimulation ? 'SIMULATION' : ''}:\n`, err)
      res.sendStatus(500)
    }
  } as Controller

// Remove all keys from object, which values equals 'undefined'
export const deleteUndefinedKeys = (obj: any) => {
  const newObj: any = {}

  for (const key in obj) {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key]
    }
  }

  return newObj
}

// Remove all keys from object, which exists in specified array
export const deleteMatchedKeys = (obj: any, matchers: string[]) => {
  const newObj: any = {}

  for (const key in obj) {
    if (!matchers.find((elem) => elem == key)) {
      newObj[key] = obj[key]
    }
  }

  return newObj
}
