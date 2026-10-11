import { ObjectId } from 'mongodb'

export type ID = string | ObjectId

export type Error = {
  msg: string
  code: number
}

export type Item = unknown
